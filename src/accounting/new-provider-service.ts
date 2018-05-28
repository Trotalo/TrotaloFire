
import { IFireBizService } from '../interfaces/i-fire-biz-service';
import { ColppyBase } from './colppy-base';
import * as admin from 'firebase-admin';
import * as util from 'util';



export class NewProviderService extends ColppyBase implements IFireBizService{

  inProgress: string;

  //private db = admin.database()

  constructor(){
    super();
    console.log('NewClientService started');
  }


  createBizObject(fireProvider: any){
    return new Promise((resolve: any, reject: any) =>{
      if(!fireProvider.colppyId){
        this.logger.log('info', 'Provider service called for' + fireProvider.name + ' from ' + fireProvider.operator);
        console.log('New Provider Request:\n' + JSON.stringify(fireProvider));
        let trxdate = new Date();
        var getOperator = this.db.ref('operators/' + fireProvider.operator);
        this.openSession()
          .then(()=>{
            return getOperator.once('value');
          })
          .then((snapshot: any)=>{
            var operator = snapshot.val();
            this.logger.log('info', 'Operator retrieved' + operator.key + ' ' + operator.comercialName);
            var clientRequest = this.getNewProviderRequest(operator, fireProvider);
            if(fireProvider.colppyId && fireProvider.colppyId.length > 0){
              this.logger.log('info', 'Edition requested');
              clientRequest.service.operacion = 'editar_cliente';
              //clientRequest.parameters.info_general.idCliente = fireProvider.colppyId;
            }
            return this.makeHttpPost(this.endpoint, clientRequest);
          })
          .then((response: any)=>{
            this.logger.log('info', 'Provider transaction finished ');
            if(response['data'].response.id_proveedor && (!fireProvider.colppyId || fireProvider.colppyId.length == 0) ){
              var updateoperator = this.db.ref('accounting/providers/' + fireProvider.operator + '/' + fireProvider.key + '/colppyId');
              updateoperator.set(response['data'].response.id_proveedor);
              resolve(fireProvider.key);
            }
          })
          .catch((error: any)=>{
            this.logger.log('error', error);
            this.recordError('accounting/providers/' + fireProvider.operator + '/' + fireProvider.key + '/disabled',
                           error,
                           trxdate,
                           fireProvider.creator,
                           'Proveedores');
            reject(fireProvider.key);
          });  
      }else{
        resolve(fireProvider.key); 
      }

      
      });


  }

  private getNewProviderRequest(operator: any, fireProvider: any){
    return {
        "auth": this.auth,
        "service": {
          "provision": "Proveedor",
          "operacion": "alta_proveedor"
        },
        "parameters": {
          "sesion": {
            "usuario": this.colppyUsr,
            "claveSesion": this.currentKey
          },
          "terceroId": "",
      		"idEmpresa": "" + operator.colppyId,
      		"RazonSocial": fireProvider.name,
      		"NombreFantasia": fireProvider.name,
      		"DirPostal": fireProvider.address,
      		"DirPostalCiudad": "",
      		"DirPostalCodigoPostal": "",
      		"DirPostalProvincia": "",
      		"DirPostalPais": "",
      		"DirFiscal": "",
      		"DirFiscalCiudad": "",
      		"DirFiscalCodigoPostal": "",
      		"DirFiscalProvincia": "",
      		"DirFiscalPais": "",
      		"Telefono": fireProvider.phone,
      		"Email": fireProvider.email,
      		"Activo": "1",
      		"FechaAlta": "",
      		"Producto": "",
      		"idCondicionPago": "",
      		"idCondicionIva": "",
      		"porcentajeIVA": "19",
      		"idTipoPercepcion": "",
      		"idPlanCuenta": "",
      		"CUIT": fireProvider.nit,
      		"isNit": fireProvider.clientType,
      		"checkDigit": "" + fireProvider.sufix,
      		"countryId": "45",
      		"regionId": "",
      		"cityId": "",
      		"primerNombre": "",
      		"segundoNombre": "",
      		"primerApellido": "",
      		"segundoApellido": "",
      		"idTercero": "",
        }
      }
  }
}
