
import { IFireBizService } from '../interfaces/i-fire-biz-service';
import { ColppyBase } from './colppy-base';
import * as admin from 'firebase-admin';
import * as util from 'util';
import * as dataFormat from 'dateformat';



export class InvoiceService extends ColppyBase implements IFireBizService{

  inProgress: string;

  //private db = admin.database()

  constructor(){
    super();
    console.log('InvoiceService started');
  }


  public createBizObject(fireInvoice: any){

    return new Promise((resolve: any, reject: any)=>{
      let operation: number;
      let operator: any;
      let trxdate =  new Date();
      var getOperator = this.db.ref('operators/' + fireInvoice.operator);
      //we check that we have a client id
      if(fireInvoice.clientNameRef.match(/[a-z]/i)){
         this.logger.log('error', 'El cliente ', fireInvoice.clientName, ' no posee un codigo de colppy');
         this.recordError('accounting/invoices/' + fireInvoice.operator + '/' + fireInvoice.key + '/disabled',
                         'El cliente '  + fireInvoice.clientName + ' no posee un codigo de colppy',
                         trxdate,
                         fireInvoice.creator, 'Facturacion');
         reject(fireInvoice.key);
      }else{

        this.openSession()
          .then((res)=>{
            return getOperator.once('value');
          })
          .then((snapshot)=>{
            operator = snapshot.val();
            //redondeamos el impuesto
            fireInvoice.taxes = Math.round( fireInvoice.taxes );
            fireInvoice.total = Math.round( fireInvoice.total );
            if(fireInvoice.colppyId && fireInvoice.colppyId.length > 0){
              operation = 1;
              this.logger.log('info', 'solictud de modificacion para: ', fireInvoice.operator);
              //first we retrieve the invoice
              let invoiceReqQery = this.getInvoiceMsg(operator.colppyId, fireInvoice.colppyId);
              return this.makeHttpPost(this.endpoint, invoiceReqQery);
            }else{
              operation = 0;
              return this.getNextInvoiceNumber(operator.colppyId, operator.colppyResfact);
            }
          })
          .then((response)=>{
            let nextNumber: any;
            let send = false;
            if(operation === 0){//nueva operacion
              nextNumber = response;
              return this.sendInvoiceMsg(fireInvoice, operator, nextNumber, this.newInvoiceMsg);
            }else{
              let infoFactura = response['data'].response.infofactura;
                  this.logger.log('info', 'Se obtuvo factura: ', infoFactura.nroFactura1 + '-'
                                            + infoFactura.nroFactura2);
                  let changed: boolean = false;
                  //verificamos todos los posibles cambios, y si se presentan cambios creamos el nuevl request
                  if(infoFactura.descripcion.toUpperCase() !== fireInvoice.activitySold.toUpperCase()
                      || infoFactura.netoNoGravado.toUpperCase() !== fireInvoice.thirdParty.toUpperCase()
                      || infoFactura.netoGravado.toUpperCase() !== fireInvoice.agency.toUpperCase()
                    ){
                    nextNumber = {
                      "prefix": infoFactura.nroFactura1,
                      "number": infoFactura.nroFactura2,
                    };
                    return this.sendInvoiceMsg(fireInvoice, operator, nextNumber, this.updateInvoiceMsg);
                  }
            }

          })//Here we update the object or register a log
          .then((response)=>{
            if(operation === 0){
              let dataToUpdate = {};
              let fbRef = this.db.ref();

              var invoiceId = response['data'].response.idfactura;
              dataToUpdate['accounting/invoices/' + fireInvoice.operator + '/' + fireInvoice.key + '/colppyId'] = invoiceId;
              dataToUpdate['accounting/invoices/' + fireInvoice.operator + '/' + fireInvoice.key + '/factId'] = response['data'].response.nroFactura;
              fireInvoice.colppyId = invoiceId;
              this.logger.log('info', 'Nueva factura con id: ' , invoiceId);
              return fbRef.update(dataToUpdate);
            }else{
              this.logger.log('info', 'Se actualizo factura: ' , fireInvoice.factId);
            }

          })
          .then((response)=>{
            this.logger.log('info', 'Finalized transaction for ' , fireInvoice.key);
            return this.sendInvoiceEmail(fireInvoice, operator, fireInvoice.colppyId);
          })
          .then((response)=>{
            resolve(fireInvoice.key);
          })
          .catch((error)=>{
              this.recordError('accounting/invoices/' + fireInvoice.operator + '/' + fireInvoice.key + '/disabled',
                         error,
                         trxdate,
                         fireInvoice.creator,
                         'Facturacion');
              reject(fireInvoice.key);
          });
      }
    });
  }

  private orEmpty(entity){
    return ',' + entity || "";
  }

  private sendInvoiceMsg = (fireInvoice, operator, factNumber, msgGenerator)=>{
    var date = new Date(fireInvoice.invoiceDate);
    let limitDate = new Date(fireInvoice.invoiceDate);
    limitDate.setDate(limitDate.getDate() + 15);

    var invoiceDateTxt = '' + date.getDate() + '-' + (date.getMonth() + 1)  + '-' + date.getFullYear();
    var limitDateTxt = '' + limitDate.getDate() + '-' + (limitDate.getMonth() + 1)  + '-' + limitDate.getFullYear();
    /*"nroFactura1": factNumber.prefix,
    "nroFactura2": factNumber.number,*/
    var request = msgGenerator(fireInvoice, operator, invoiceDateTxt, limitDateTxt, factNumber);
    return this.makeHttpPost(this.endpoint, request);
  };

  /**
   * Method to send and invoice registered in colppy
   * @type {[type]}
   */
  private sendInvoiceEmail = (fireInvoice, operator, invoiceId)=>{

    return new Promise((resolve: any, reject: any)=>{
      var getClient = this.db.ref('accounting/clients/' + fireInvoice.operator + '/' + fireInvoice.clientNameOrig);
      getClient.once('value')
        .then((clientSnapshot: any)=>{
          var client = clientSnapshot.val();
          client.key = clientSnapshot.key;
          let mails: string = '';
          if(fireInvoice.sendMail){
            mails = (client.email === operator.email) ? operator.email : (this.orEmpty(client.email) + this.orEmpty(operator.email)).substr(1);
          }else{
            mails = operator.email;
          }
          if(!client.colppyId){
            this.logger.log('error', 'El cliente ', client.name, ' no posee un codigo de colppy');
            reject(fireInvoice.key);
          }
          var mailRequest = this.setInvoiceMailMsg(operator.colppyId, client.colppyId, mails, operator.comercialName );
          this.logger.log('info', 'Formato de correo enviado para: ' , client.colppyId, mails);
          return this.makeHttpPost(this.endpoint, mailRequest);
        })
        .then((response: any)=>{
          //once we get the mail response we call the last endpoint to send the mail
          var request = 'https://login.colppy.com/resources/php/fe/FE_ImprimirEnviarFactura.php?' +
                        'idEmpresa=' + operator.colppyId +
                        '&idCliente=' + fireInvoice.clientNameRef +
                        '&idFactura=' + fireInvoice.colppyId +
                        '&correo=yes';
          return this.makeHttpGet(request);
        })
        .then((response)=>{
          this.logger.log('info', 'Factura envida para ' +  operator.comercialName  );
          resolve();
        });
    });
  }

  public getInvoiceMsg = (idEmpresa: any, idFactura)=>{
    return {
      "auth": this.auth,
      "service": {
        "provision": "FacturaVenta",
        "operacion": "leer_facturaventa"
      },
      "parameters": {
        "sesion": {
          "usuario": this.colppyUsr,
          "claveSesion": this.currentKey
        },
        "idEmpresa": idEmpresa,
        "idFactura": idFactura,
        "idElemento": "8",
        "sort": "FTimeStamp",
        "dir": "desc",
        "start": "0",
        "limit": "50"
      }
    }
  }

  public setInvoiceMailMsg = (idEmpresa: any, idCliente: any, mailCliente: string, nombreEmpresa: string)=>{
    return {
      "auth": this.auth,
      "service": {
        "provision": "Cliente",
        "operacion": "alta_mailfactura"
      },
      "parameters": {
        "sesion": {
          "usuario": this.colppyUsr,
          "claveSesion": this.currentKey
        },
        "idEmpresa": '' + idEmpresa,
        "idCliente": '' + idCliente,
        "asunto": "Adjuntamos su $datos[\"tipoComprobante\"] Nro: $datos[\"nroFactura\"]",
        "mensaje": `<p>Estimado cliente $datos[\"razonSocialCliente\"]:</p>
          <p>Le informamos que hemos emitido la $datos[\"tipoComprobante\"] $datos[\"letra\"] Nro. $datos[\"nroFactura\"]
          por el valor de $ $datos[\"totalFactura\"].
          La misma está adjunta al presente correo en formato PDF.</p><p></p><p></p>`,
        "destinatarios": mailCliente,
        "nombre_sender": nombreEmpresa
      }
    }
  }

  /**
   * Factory method to generate the scheleton of the invoice request
   * @param {[type]} fireInvoice [description]
   * @param {[type]} operator    [description]
   * @param {[type]} invoiceDate [description]
   * @param {[type]} factNumber  [description]
   */
  public newInvoiceMsg = (fireInvoice: any, operator: any, invoiceDate: string, limitDateTxt: string, factNumber: any)=>{
    this.logger.log('info', 'Nuevo request: \nFecha:'+ invoiceDate + '\nTrama:' + util.inspect(fireInvoice))
    let returnValue =  {
      "auth": this.auth,
      "service": {
        "provision": "FacturaVenta",
        "operacion": "alta_facturaventa"
      },
      "parameters": {
        "sesion": {
          "usuario": this.colppyUsr,
          "claveSesion": this.currentKey
        },
        "country_id": "45",
        "descripcion": fireInvoice.activitySold,
        "fechaFactura": invoiceDate,
        "fechaPago": limitDateTxt,
        "idCliente": fireInvoice.clientNameRef,
        "idCondicionPago": "Contado",
        "idEmpresa": '' + operator.colppyId,
        "idEstadoAnterior": "",
        "idEstadoFactura": "Aprobada",
        "idFactura": "",
        "idMoneda": "1",
        "idTipoComprobante": "4",
        "idTipoFactura": "",
        "idUsuario": this.colppyUsr,
        "labelfe": "",
        "netoGravado": fireInvoice.agency,
        "netoNoGravado": fireInvoice.thirdParty,
        "nroFactura1": factNumber.prefix,
        "nroFactura2": factNumber.number,
        "percepcionIIBB": "0",
        "IIBBLocal": "0",
        "percepcionIVA": 0,
        "idTipoRetencion": "",
        "orderId": "",
        "itemsFactura": [],
        "totalFactura": fireInvoice.total,
        "totalIVA": fireInvoice.taxes,
        "valorCambio": "1",
        "nroRepeticion": "1",
        "periodoRep": "1",
        "nroVencimiento": "",
        "tipoVencimiento": "1",
        "fechaFin": "",
        "nroRemito1": "",
        "nroRemito2": "",
        "totalesiva": [],
        "totalCREE": 0,
        "nroResolucion": '' + operator.colppyResfact,
        "retencionICA": 0,
        "retsufridas": [],
        "reteIVA": 0
      }
    }
    returnValue.parameters.itemsFactura = this.getItemsFacturaMsgPrt(fireInvoice, operator);

    if(fireInvoice.taxes && fireInvoice.taxes != 0){
      returnValue.parameters.totalesiva = [{
          "alicuotaIva": "19",
          "importeIva": fireInvoice.taxes,
          "baseImpIva": fireInvoice.agency
        }]
    }
    return returnValue;
  }

  /**
   * Factory method to generate the scheleton of the invoice request
   * @param {[type]} fireInvoice [description]
   * @param {[type]} operator    [description]
   * @param {[type]} invoiceDate [description]
   * @param {[type]} factNumber  [description]
   */
  public updateInvoiceMsg = (fireInvoice: any, operator: any, invoiceDate: string, limitDateTxt: string, factNumber: any)=>{
    this.logger.log('info', 'Update request: \nFecha:'+ invoiceDate + '\nTrama:' + util.inspect(fireInvoice))
    let returnValue =  {
      "auth": this.auth,
      "service": {
        "provision": "FacturaVenta",
        "operacion": "editar_facturaventa"
      },
      "parameters": {
        "sesion": {
          "usuario": this.colppyUsr,
          "claveSesion": this.currentKey
        },
        "country_id": "45",
        "IVA105": "",
        "IVA21": "",
        "IVA27": "",
        "descripcion": fireInvoice.activitySold,
        "fechaFactura": invoiceDate,
        "fechaPago": limitDateTxt,
        "idCliente": fireInvoice.clientNameRef,
        "idCondicionPago": "Contado",
        "idEmpresa": '' + operator.colppyId,
        "idEstadoAnterior": "Aprobada",
        "idEstadoFactura": "Aprobada",
        "idFactura": fireInvoice.colppyId,
        "idMoneda": "1",
        "idTipoComprobante": "4",
        "idTipoFactura": "A",
        "idUsuario": this.colppyUsr,
        "labelfe": "",
        "netoGravado": fireInvoice.agency,
        "netoNoGravado": fireInvoice.thirdParty,
        "nroFactura1": factNumber.prefix,
        "nroFactura2": factNumber.number,
        "percepcionIIBB": "0.00",
        "IIBBLocal": "CABA",
        "percepcionIVA": 0,
        "idTipoRetencion": "0",
        "orderId": "0",
        "totalFactura": fireInvoice.total,
        "totalIVA": fireInvoice.taxes,
        "nroResolucion": '' + operator.colppyResfact,
      }
    }

    returnValue.parameters['itemsFactura'] = this.getItemsFacturaMsgPrt(fireInvoice, operator);

    if(fireInvoice.taxes && fireInvoice.taxes != 0){
      returnValue.parameters['totalesiva'] = [{
          "alicuotaIva": "19",
          "importeIva": fireInvoice.taxes,
          "baseImpIva": fireInvoice.agency
        }]
    }
    return returnValue;
  }

  private

  private getItemsFacturaMsgPrt = (fireInvoice, operator)=>{
    //validamos si tiene o no algun cobro para evitar enviar el item
    let returnValue: any;
    if(fireInvoice.thirdParty && fireInvoice.thirdParty != 0
        && fireInvoice.agency && fireInvoice.agency != 0){
      returnValue = [{
          "idItem": operator.colppyThirdCode,
          "tipoItem": "S",
          "codigo": "000001",
          "Descripcion": fireInvoice.activitySold,
          "ccosto1": "",
          "ccosto2": "",
          "almacen": "",
          "unidadMedida": "v",
          "Cantidad": 1,
          "ImporteUnitario": fireInvoice.thirdParty,
          "porcDesc": "0",
          "IVA": "0",
          "subtotal": fireInvoice.thirdParty,
          "idPlanCuenta": "281505 VALORES RECIBIDOS PARA TERCEROS",
          "Comentario": "pagos a terceros",
          "editable": false
        },
        {
          "idItem": operator.colppyOwnCode,
          "tipoItem": "S",
          "codigo": "000002",
          "Descripcion": "Cobro agencia",
          "ccosto1": "",
          "ccosto2": "",
          "almacen": "",
          "unidadMedida": "v",
          "Cantidad": 1,
          "ImporteUnitario": fireInvoice.agency,
          "porcDesc": "0",
          "IVA": "19",
          "subtotal": fireInvoice.agency,
          "idPlanCuenta": "417040 ENTRETENIMIENTO Y ESPARCIMIENTO",
          "Comentario": "Cobro agencia",
          "editable": false
        }];
    }else //debemos validar si existe uno o el otro
      if(!fireInvoice.thirdParty || fireInvoice.thirdParty == 0){
        returnValue = [{
          "idItem": operator.colppyOwnCode,
          "tipoItem": "S",
          "codigo": "000002",
          "Descripcion": fireInvoice.activitySold,
          "ccosto1": "",
          "ccosto2": "",
          "almacen": "",
          "unidadMedida": "v",
          "Cantidad": 1,
          "ImporteUnitario": fireInvoice.agency,
          "porcDesc": "0",
          "IVA": "19",
          "subtotal": fireInvoice.agency,
          "idPlanCuenta": "417040 ENTRETENIMIENTO Y ESPARCIMIENTO",
          "Comentario": "Cobro agencia",
          "editable": false
        }];
      } else
        if(!fireInvoice.agency || fireInvoice.agency == 0){
          returnValue = [{
          "idItem": operator.colppyThirdCode,
          "tipoItem": "S",
          "codigo": "000001",
          "Descripcion": fireInvoice.activitySold,
          "ccosto1": "",
          "ccosto2": "",
          "almacen": "",
          "unidadMedida": "v",
          "Cantidad": 1,
          "ImporteUnitario": fireInvoice.thirdParty,
          "porcDesc": "0",
          "IVA": "0",
          "subtotal": fireInvoice.thirdParty,
          "idPlanCuenta": "281505 VALORES RECIBIDOS PARA TERCEROS",
          "Comentario": "pagos a terceros",
          "editable": false
        }];
        }
        return returnValue;
  }
}
