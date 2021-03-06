
import { IFireBizService } from '../interfaces/i-fire-biz-service';
import { ColppyBase } from './colppy-base';
import * as admin from 'firebase-admin';
import * as util from 'util';



export class NewClientService extends ColppyBase implements IFireBizService{

  inProgress: string;

  //private db = admin.database()

  constructor(){
    super();
    console.log('NewClientService started');
  }


  createBizObject(fireClient: any){
    return new Promise((resolve: any, reject: any) =>{

      if(!fireClient.colppyId){
        this.logger.log('info', 'Clients service called for' + fireClient.name + ' from ' + fireClient.operator);
        let trxdate = new Date();
        var getOperator = this.db.ref('operators/' + fireClient.operator);
        this.openSession()
          .then(()=>{
            return getOperator.once('value');
          })
          .then((snapshot: any)=>{
            var operator = snapshot.val();
            this.logger.log('info', 'Operator retrieved' + operator.key + ' ' + operator.comercialName);
            var clientRequest = this.getClientRequest(operator, fireClient);
            if(fireClient.colppyId && fireClient.colppyId.length > 0){
              this.logger.log('info', 'Edition requested');
              clientRequest.service.operacion = 'editar_cliente';
              clientRequest.parameters.info_general.idCliente = fireClient.colppyId;
            }
            return this.makeHttpPost(this.endpoint, clientRequest);
          })
          .then((response: any)=>{
            this.logger.log('info', 'Client transaction finished ');
            if(response['data'].response.data.idCliente && (!fireClient.colppyId || fireClient.colppyId.length == 0) ){
              var updateoperator = this.db.ref('accounting/clients/' + fireClient.operator + '/' + fireClient.key + '/colppyId');
              updateoperator.set(response['data'].response.data.idCliente);
              resolve(fireClient.key);
            }
          })
          .catch((error: any)=>{
            this.logger.log('error', error);
            this.recordError('accounting/clients/' + fireClient.operator + '/' + fireClient.key + '/disabled',
                           error,
                           trxdate,
                           fireClient.creator,
                           'Cientes');
            reject(fireClient.key);
          });
        }else{
          resolve(fireClient.key);
        }
      
      });


  }

  private getClientRequest(operator: any, fireClient: any){
    return {
        "auth": this.auth,
        "service": {
          "provision": "Cliente",
          "operacion": "alta_cliente"
        },
        "parameters": {
          "sesion": {
            "usuario": this.colppyUsr,
            "claveSesion": this.currentKey
          },
           "info_general": {
                  "idUsuario": "",
                  "idCliente": "",
                  "idEmpresa": operator.colppyId,
                  "NombreFantasia": fireClient.name,
                  "RazonSocial": fireClient.name,
                  "CUIT": fireClient.nit,
                  "dni": "",
                  "DirPostal": "",
                  "DirPostalCiudad": "",
                  "DirPostalCodigoPostal": "",
                  "DirPostalProvincia": "",
                  "DirPostalPais": (fireClient.nationality && fireClient.nationality.length >= 14) ? fireClient.nationality.substring(0, 14) : fireClient.nationality,
                  "Telefono": "",
                  "Email": fireClient.email
              },
              "info_otra": {
                  "Activo": "1",
                  "FechaAlta": "",
                  "DirFiscal": "",
                  "DirFiscalCiudad": "",
                  "DirFiscalCodigoPostal": "",
                  "DirFiscalProvincia": "",
                  "DirFiscalPais": "",
                  "idCondicionPago": "",
                  "idCondicionIva": "",
                  "porcentajeIVA": "",
                  "idPlanCuenta": "",
                  "CuentaCredito": "",
                  "DirEnvio": "",
                  "DirEnvioCiudad": "",
                  "DirEnvioCodigoPostal": "",
                  "DirEnvioProvincia": "",
                  "DirEnvioPais": ""
              }
          }
      }
  }
}
