
import { IFireBizService } from '../interfaces/i-fire-biz-service';
import { ColppyBase } from './colppy-base';
import * as admin from 'firebase-admin';
import * as util from 'util';



export class NewClientService extends ColppyBase implements IFireBizService{

  inProgress: string;

  private db = admin.database()

  constructor(){
    super();
    console.log('NewClientService started');
    this.openSession();
  }


  createBizObject(fireClient: any){
    return new Promise((resolve: any, reject: any) =>{
      this.logger.log('info', 'Clients service called for' + fireClient.name + ' from ' + fireClient.operator);
      this.openSession();
      var getOperator = this.db.ref('operators/' + fireClient.operator);
      getOperator.on('value', (snapshot: any)=>{
        var operator = snapshot.val();
        this.logger.log('info', 'Operator retrieved' + operator.key + ' ' + operator.comercialName);
        var clientRequest = this.getClientRequest(operator, fireClient);
        if(fireClient.colppyId && fireClient.colppyId.length > 0){
          this.logger.log('info', 'Edition requested');
          clientRequest.service.operacion = 'editar_cliente';
          clientRequest.parameters.info_general.idCliente = fireClient.colppyId;
        }

        this.makeHttpPost(this.endpoint, clientRequest)
          .then((response: any)=>{
            this.logger.log('info', 'Client transaction finished ');
            if(response['data'].response.data.idCliente && (!fireClient.colppyId || fireClient.colppyId.length == 0) ){
              var updateoperator = this.db.ref('accounting/clients/' + fireClient.key + '/colppyId');
              updateoperator.set(response['data'].response.data.idCliente);
              resolve(fireClient.key);
            }
          })
          .catch((error: any)=>{
            this.logger.log('error', error);
            reject(fireClient.key);
          });
      });
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
                  "DirPostalPais": fireClient.nationality,
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
