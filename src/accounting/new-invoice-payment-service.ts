
import { IFireBizService } from '../interfaces/i-fire-biz-service';
import { ColppyBase } from './colppy-base';
import * as admin from 'firebase-admin';
import * as util from 'util';



export class NewInvoicePaymentService extends ColppyBase implements IFireBizService{

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
      this.logger.log('info', 'Invoice Payments service called for' + firePayment.invoiceNro + ' from ' + firePayment.operator);
      let trxdate = new Date();
      var getOperator = this.db.ref('operators/' + firePayment.operator);
      var operator = null;
      var consecutive;
      var saldo;
      this.openSession()
      .then(()=>{
        return getOperator.once('value');
      })
      .then((snapshot: any)=>{
        operator = snapshot.val();
        operator.key = snapshot.key;
        this.logger.log('info', 'Operator retrieved' + operator.key + ' ' + operator.comercialName);
        //first we retrieve the consecutive
        return this.getNextInvoiceNumber(operator.colppyId, '', 'REC');
      }).then((nextRecNumber:any)=>{
        saldo = firePayment.saldo ? (firePayment.saldo - firePayment.totalPago) 
                                  : (firePayment.totalFactura - firePayment.totalPago);
        consecutive = nextRecNumber.number;
        var clientRequest = this.getInvoicePaymentRequest(operator, firePayment, consecutive, saldo);
        return this.makeHttpPost(this.endpoint, clientRequest);
      })
      .then((response: any)=>{
        this.logger.log('info', 'Inovice Payment transaction finished ');
        if(response['data'].response.idCobro){
          var updateoperator = this.db.ref('accounting/income/' + firePayment.operator + '/' + firePayment.key );
          updateoperator.update({
            'colppyId': response['data'].response.idCobro,
            'number': consecutive,
            'saldo': saldo
          });

          var updateInvoice = this.db.ref('accounting/invoices/' + firePayment.operator + '/' + firePayment.invoiceKey );
          updateInvoice.update({
            'saldo': saldo
          });
          resolve(firePayment.key);
        }else{
          this.recordError('accounting/income/' + firePayment.operator + '/' + firePayment.key + '/disabled',
          'respuesta mal formada! ' + JSON.stringify(response) ,
          trxdate,
          firePayment.creator,
          'InvoicePayments');
        reject(firePayment.key);  
        }
      })
      .catch((error: any)=>{
        this.logger.log('error', error);
        this.recordError('accounting/income/' + firePayment.operator + '/' + firePayment.key + '/disabled',
          error.stack?error.stack:error,
          trxdate,
          firePayment.creator,
          'InvoicePayments');
        reject(firePayment.key);
      });
    });
  }

  private getInvoicePaymentRequest(operator: any, firePayment: any, consecutive: any, saldo: any){
    var date = new Date(firePayment.paymentDate);
    var invoiceDate = '' + date.getDate() + '-' + (date.getMonth() + 1)  + '-' + date.getFullYear();
    
    let returnValue = {
      "auth": this.auth,
      "service": {
        "provision": "Cliente",
        "operacion": "alta_cobro"
      },
      "parameters": {
        "sesion": {
          "usuario": this.colppyUsr,
          "claveSesion": this.currentKey
        },
        "estesoreria": "0",
        "idUsuario": this.colppyUsr,
        "idCobro": "",
        "idCliente": firePayment.clientId,
        "idEmpresa": operator.colppyId,
        "nroRecibo1": "",
        "nroRecibo2": consecutive,
        "fechaCobro": invoiceDate,
        "idEstadoCobro": "Aprobado",
        "descripcion": "",
        "valorCambio": "0",
        "totalEsteCobro": firePayment.totalPago,
        "saldoFacturas": saldo,
        "anticipo": 0,
        "descuentos": 0,
        "intereses": 0,
        "retencionIIBB": 0,
        "totalACobrar": firePayment.totalPago,
        "idMedioCobro": firePayment.paymentMethod === 0 ? "Efectivo" : "Transferencia",//0 efectivo, 1 bancos
        "totalCobrado": firePayment.totalPago,
        "retsufridas": [],
        "retsufridasotras": [],
        "cobros": [{
            "idFactura": firePayment.invoiceColppyId,
            "nroFactura": firePayment.invoiceNro,
            "tipoComprobante": "FAV",
            "fechaPago": invoiceDate,
            "moneda": "",
            "totalFactura": firePayment.totalFactura,
            "cobrado": 0,
            "saldoAnterior": firePayment.saldo ? firePayment.saldo : firePayment.totalFactura,
            "esteCobro": firePayment.totalPago,
            "Saldo": saldo,
            "pagar": true
          }
        ],
      }
    }
    //finalmente setamos la informacion del pago
    if(firePayment.paymentMethod === 0){
      //pago en efectivo
      returnValue.parameters['mediospagos'] = [{
          "idMedioPago": "Efectivo",
          "idPlanCuenta": "Caja General",
          "nroCheque": "",
          "fechaValidez": "",
          "importe": '' + firePayment.totalPago,
          "idTabla": 0,
          "idElemento": 0,
          "idItem": 0,
          "CED": "S",
          "Conciliado": ""
        }];
    }else{
      //transferencia
      returnValue.parameters['mediospagos'] = [{
          "idMedioPago": "Transferencia",
          "idPlanCuenta": "Banco 1",
          "nroCheque": "",
          "fechaValidez": "",
          "importe": '' + firePayment.totalPago,
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
