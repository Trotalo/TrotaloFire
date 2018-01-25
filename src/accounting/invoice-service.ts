
import { IFireBizService } from '../interfaces/i-fire-biz-service';
import { ColppyBase } from './colppy-base';
import * as admin from 'firebase-admin';
import * as util from 'util';
import * as dataFormat from 'dateformat';



export class InvoiceService extends ColppyBase implements IFireBizService{

  inProgress: string;

  private db = admin.database()

  constructor(){
    super();
    console.log('InvoiceService started');
    this.openSession();
  }


  createBizObject(fireInvoice: any){
    this.logger.log('info', 'solictud de factura nueva para: ', fireInvoice.operator);
    this.openSession();
    var getOperator = this.db.ref('operators/' + fireInvoice.operator);
    var getClient = this.db.ref('accounting/clients/' + fireInvoice.clientNameOrig);

    getOperator.on('value', (snapshot: any)=>{
      var operator = snapshot.val();
      //firwt we validate if we are updating or creating a new inovice
      if(fireInvoice.colppyId && fireInvoice.colppyId.length > 0){
        this.logger.log('info', 'invoice modification');
      }else{
        this.getNextInvoiceNumber(operator.colppyId, operator.colppyResfact)
          .then((nextNumber: any)=>{
            this.logger.log('info', 'Numero de factura para empresa: ' + operator.colppyId + ' es ' + util.inspect(nextNumber));
            //now we build the rest of the petitition
            var date = new Date(fireInvoice.invoiceDate);
            var invoiceDateTxt = '' + date.getDate() + '-' + date.getMonth()  + '-' + date.getFullYear();
            var request = this.getInvoiceRequest(fireInvoice, operator, invoiceDateTxt, nextNumber);
            this.makeHttpPost(this.endpoint, request)
              .then((response: any)=>{
                //revaldiate that the invoice is new
                var updateoperator = this.db.ref('accounting/invoices/' + fireInvoice.key + '/colppyId');
                var invoiceId = response['data'].response.idfactura;
                updateoperator.set(invoiceId);
                this.logger.log('info', 'Nueva factura con id: ' , invoiceId);
                //once the invoice is set, we configure the mailer and send the mail
                //to get the user mail we need to retrrive the user
                getClient.on('value', (clientSnapshot: any)=>{
                  var client = clientSnapshot.val();
                  client.key = clientSnapshot.key;
                  var mailRequest = this.getMailRequest(operator.colppyId, client.colppyId, client.email, operator.comercialName );
                  this.makeHttpPost(this.endpoint, mailRequest)
                    .then((response: any)=>{
                      this.logger.log('info', 'Formato de correo seteado para evio a: ' , client.email);
                      //once we get the mail response we call the last endpoint to send the mail
                      var request = 'https://login.colppy.com/resources/php/fe/FE_ImprimirEnviarFactura.php?' + 
                                    'idEmpresa=' + operator.colppyId + 
                                    '&idCliente=' + fireInvoice.clientNameRef +
                                    '&idFactura=' + invoiceId + 
                                    '&correo=yes';
                      this.makeHttpGet(request);
                      this.logger.log('info', 'Factura de ' +  operator.comercialName  + ' enviada a ' + client.email);
                    })
                    .catch((error: any)=>{
                      this.logger.log('error', error);
                    });
                });            
              })
              .catch((error: any)=>{
                this.logger.log('error', error);
              });

          })  
      }
      
    });
    

    //first we retrieve the
    //first we initialize
  }

  public getMailRequest(idEmpresa: any, idCliente: any, mailCliente: string, nombreEmpresa: string){
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
        "idEmpresa": idEmpresa,
        "idCliente": idCliente,
        "asunto": "Adjuntamos su $datos[\"tipoComprobante\"] Nro: $datos[\"nroFactura\"]",
        "mensaje": "<p>Estimado cliente $datos[\"razonSocialCliente\"]:</p><p>Le informamos que hemos emitido la $datos[\"tipoComprobante\"] $datos[\"letra\"] Nro. $datos[\"nroFactura\"] por el valor de $ $datos[\"totalFactura\"]. La misma está adjunta al presente correo en formato PDF.</p><p></p><p></p>",
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
  public getInvoiceRequest(fireInvoice: any, operator: any, invoiceDate: any, factNumber: any){
    return {
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
        "fechaPago": invoiceDate,
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
        "itemsFactura": [{
          "idItem": operator.colppyThirdCode,
          "tipoItem": "S",
          "codigo": "000001",
          "Descripcion": "pagos a terceros",
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
        }],
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
        "totalesiva": [
        {
          "alicuotaIva": "19",
          "importeIva": fireInvoice.taxes,
          "baseImpIva": fireInvoice.agency
        }],
        "totalCREE": 0,
        "nroResolucion": '' + operator.colppyResfact,
        "retencionICA": 0,
        "retsufridas": [],
        "reteIVA": 0
      }
    }

  }
}