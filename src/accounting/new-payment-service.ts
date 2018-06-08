
import { IFireBizService } from '../interfaces/i-fire-biz-service';
import { ColppyBase } from './colppy-base';
import * as admin from 'firebase-admin';
import * as util from 'util';



export class NewPaymentService extends ColppyBase implements IFireBizService{

  inProgress: string;
  db: any;

  //private db = admin.database()

  constructor(){
    super();
    console.log('NewPaymentService started');
    this.db = admin.database();  
  }


  createBizObject(firePayment: any){
    return new Promise((resolve: any, reject: any) =>{
      if(firePayment.status === 0 || firePayment.colppyId){
        //en caso que no se halla completado el cobro no continuamos
        resolve(firePayment.key);
        return;
      }
      this.logger.log('info', 'Payments service called for' + firePayment.name + ' from ' + firePayment.operator);
      let trxdate = new Date();
      var getOperator = this.db.ref('operators/' + firePayment.operator);
      var operator = null;
      var consecutive;
      this.openSession()
      .then(()=>{
        return getOperator.once('value');
      })
      .then((snapshot: any)=>{
        operator = snapshot.val();
        operator.key = snapshot.key;
        this.logger.log('info', 'Operator retrieved' + operator.key + ' ' + operator.comercialName);
        //first we retrieve the consecutive
        return this.getPaymentId(firePayment.providerNameOrig, operator.key);
      }).then((response:any)=>{
        consecutive = response;
        var clientRequest = this.getPaymentRequest(operator, firePayment, response);
        return this.makeHttpPost(this.endpoint, clientRequest);
      })
      .then((response: any)=>{
        this.logger.log('info', 'Payment transaction finished ');
        if(response['data'].response.idFactura && (!firePayment.colppyId || firePayment.colppyId.length == 0) ){
          var updateoperator = this.db.ref('accounting/payments/' + firePayment.operator + '/' + firePayment.key );
          updateoperator.update({
            'colppyId': response['data'].response.idFactura,
            'number': consecutive
          });

          /*var updateoperator = this.db.ref('accounting/payments/' + firePayment.operator + '/' + firePayment.key + '/colppyId');
          updateoperator.set(response['data'].response.idFactura);
          var updateoperator = this.db.ref('accounting/payments/' + firePayment.operator + '/' + firePayment.key + '/number');
          updateoperator.set(consecutive);*/
          resolve(firePayment.key);
        }
      })
      .catch((error: any)=>{
        this.logger.log('error', error);
        this.recordError('accounting/payments/' + firePayment.operator + '/' + firePayment.key + '/disabled',
          error.stack?error.stack:error,
          trxdate,
          firePayment.creator,
          'Payments');
        reject(firePayment.key);
      });
    });
  }

  private getPaymentId(providerId:string, operatorId: string){
    return new Promise((resolve:any, reject:any)=>{
      //this.db.app.database().ref().child('accounting/providers/'+ operatorId +'/' + providerId + '/paymentId')
      this.db.app.database().ref().child('operators/paymentConsecutive'+ operatorId)
        .transaction((count) =>{
          return count ? ++count : 1;
        }, (err, committed, ss)=>{
          if( err ) {
            console.log('error: ' + err);
            reject(err);
          }
          else if( committed ) {
            resolve(ss.val()); 
          } 
        }); 
    });
  }

  private getPaymentRequest(operator: any, firePayment: any, consecutive: any){
    var date = new Date(firePayment.paymentDate);
    var invoiceDate = '' + date.getDate() + '-' + (date.getMonth() + 1)  + '-' + date.getFullYear();
    var totalpago = parseFloat(firePayment.totalPago) + 
                  parseFloat(firePayment.iva?firePayment.iva:'0') - 
                  ( parseFloat(firePayment.reteFuente?firePayment.reteFuente:'0') + 
                    parseFloat(firePayment.ica?firePayment.ica:'0'));
    let returnValue = {
      "auth": this.auth,
      "service": {
        "provision": "FacturaCompra",
        "operacion": "alta_facturacompra"
      },
      "parameters": {
        "sesion": {
          "usuario": this.colppyUsr,
          "claveSesion": this.currentKey
        },
        "IVA105": "",
        "IVA21": "",
        "IVA27": "",
        "descripcion": firePayment.concept,
        "esresumen": "0",
        "fechaFactura": invoiceDate,
        "fechaFacturaDoc": invoiceDate,
        "idCondicionIva": "0",
        "idEmpresa": '' + operator.colppyId,
        "idEstadoAnterior": "",
        "idEstadoFactura": "Pagada",
        "idFactura": "",
        "idMedioPago": "",
        "idProveedor": firePayment.providerNameRef,
        "idTipoComprobante": "Fc",
        "idTipoFactura": "",
        "netoGravado": firePayment.totalPago,
        "netoNoGravado": 0,
        "nroFactura1": "",
        "nroFactura2": '' + consecutive,
        "percepcionIIBB": "0",
        "itemsFactura": [{
          "idItem": 0,
          "tipoItem": "",
          "codigo": "",
          "Descripcion": firePayment.concept,
          "almacen": "",
          "ccosto1": "",
          "ccosto2": "",
          "unidadMedida": "s",
          "Cantidad": 1,
          "ImporteUnitario": firePayment.totalPago,
          "IVA": "4",
          "idPlanCuenta": firePayment.ctaPago
        }
        ],
        "tipoFactura": "Contado",
        "totalFactura": totalpago,
        "totalIVA": firePayment.iva,
        "totalpagadofactura": totalpago,
        "percsufridas": [],
        "totalesiva": [ {
          "alicuotaIva": "4",
          "importeIva": firePayment.iva,
          "baseImpIva": firePayment.totalPago
        }
        ],
        "retencionICA": firePayment.ica,
        "retsufridas": [{
          "municipio": "Bogotá D.C.: BOGOTÁ, D.C.",
          "importeRet": firePayment.ica
        }
        ]
      }
    }
    //ahora agregamos los datos de la rtFte
    if(firePayment.idRteFte && firePayment.reteFuente && firePayment.reteFuente > 0){
      returnValue.parameters['idTipoRetencion'] = firePayment.idRteFte;
      returnValue.parameters['RETE'] = 'S';
      returnValue.parameters['percepcionIVA'] = "" + firePayment.reteFuente;
    }else{
      returnValue.parameters['idTipoRetencion'] = "";
      returnValue.parameters['percepcionIVA'] = 0;
    }
    //finalmente setamos la informacion del pago
    if(firePayment.paymentMethod === 0){
      //pago en efectivo
      returnValue.parameters['itemsPagos'] = [{
          "idMedioPago": "Efectivo",
          "idPlanCuenta": "Caja General",
          "nroCheque": "",
          "fechaValidez": "",
          "importe": '' + totalpago,
          "idTabla": 0,
          "idElemento": 0,
          "idItem": 0,
          "CED": "S",
          "Conciliado": ""
        }];
    }else{
      //transferencia
      returnValue.parameters['itemsPagos'] = [{
          "idMedioPago": "Transferencia",
          "idPlanCuenta": "Banco 1",
          "nroCheque": "",
          "fechaValidez": "",
          "importe": '' + totalpago,
          "idTabla": 0,
          "idElemento": 0,
          "idItem": 0,
          "CED": "S",
          "Conciliado": ""
        }];
    }

    return returnValue;

  }
}
