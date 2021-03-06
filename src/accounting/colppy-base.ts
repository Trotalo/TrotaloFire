import axios from 'axios';
import * as  winston from 'winston';

import * as admin from 'firebase-admin';

import { Enviroment } from '../enviroment/enviroment';


export class ColppyBase{

  protected db = admin.database()

  protected currentKey: string = '';
  protected loginTime: number = -1;
  protected endpoint: string = 'http://login.colppy.com/lib/frontera2/service.php';
  protected colppyUsr: string = Enviroment.SYS_CONFIG.colppyUsr;
  //protected colppyUsr: string = 'gato.climber@gmail.com';
  protected colppyPassw: string = Enviroment.SYS_CONFIG.colppyPassw;

  protected logger = new (winston.Logger)({
    transports: [
    new (winston.transports.Console)(),
    //new (winston.transports.File)({ filename: 'colppyTrx.log' })
    ]
  });

  //private axiosConnector = new AxiosInstance.();

  protected auth = {
    usuario: 'camilo.casadiego@gmail.com',
    password: '9636e4dc1f56adee52835c377b0b6d55'
    /*usuario: 'ColppyAPI',
    password: '9410c05b7bfadea3ab7b573180862222'*/
  }


  public openSession(){
    return new Promise((resolve: any, reject: any)=> {
      if(Date.now() - this.loginTime > 1800000 ){
        let loginRequest = {
          'auth': this.auth,
          'service': {
            'provision':'Usuario',
            'operacion':'iniciar_sesion'
          },
          'parameters': {
            'usuario': this.colppyUsr,
            'password': this.colppyPassw
          }
        }
        this.makeHttpPost(this.endpoint, loginRequest)
        .then((response: any)=>{
          this.currentKey = response['data'].response.data.claveSesion;
          this.loginTime = Date.now();
          this.logger.log('info', 'connection started with id ' + this.currentKey);
          resolve();
        })
        .catch((error: any)=>{
          this.logger.log('error', error);
          reject();
        });
      }else{
        resolve();
      }
    });
    
  }

  /**
   * Facade method to call an http api
   * @param {string} url     the url to call
   * @param {[type]} payload the payload to send as a post
   */
  public makeHttpPost(url:string, payload: any){
    return new Promise((resolve: any, reject: any)=> {
      //setTimeout(() => resolve(), N);
      axios.post(url, payload)
      .then((response: any)=>{
        if(!response['data'].response || !response['data']){
          this.logger.log('error', 'La respuesta del serivor esta incompleta', response['data'].result.mensaje);
          reject(response);
        }else
          if(response['data'].response.success === false){
            reject(response['data'].response.message);
          }else {
            resolve(response);  
          }
      }).catch((error: any)=>{
        if (error.response) {
            // The request was made and the server responded with a status code
            // that falls out of the range of 2xx
            this.logger.log('error', error.response.data);
            this.logger.log('error', error.response.status);
            this.logger.log('error', error.response.headers);
          } else if (error.request) {
            // The request was made but no response was received
            // `error.request` is an instance of XMLHttpRequest in the browser and an instance of
            // http.ClientRequest in node.js
            this.logger.log('error', error.request);
          } else {
            // Something happened in setting up the request that triggered an Error
            this.logger.log('error', error.message);
          }
        this.logger.log('error', error.config);
        reject(error);
        });
    });
  }

  /**
   * Faced method to execute http get calls
   * @param {string} url [description]
   */
  public makeHttpGet(url:string){
    return new Promise( (resolve: any, reject: any) =>{
      //setTimeout(() => resolve(), N);
      axios.get(url)
      .then((response: any)=>{
        //this.logger.log('info', 'response from ', url, response );
        resolve(response);
      }).catch((error: any)=>{
        if (error.response) {
            // The request was made and the server responded with a status code
            // that falls out of the range of 2xx
            this.logger.log('error', error.response.data);
            this.logger.log('error', error.response.status);
            this.logger.log('error', error.response.headers);
          } else if (error.request) {
            // The request was made but no response was received
            // `error.request` is an instance of XMLHttpRequest in the browser and an instance of
            // http.ClientRequest in node.js
            this.logger.log('error', error.request);
          } else {
            // Something happened in setting up the request that triggered an Error
            this.logger.log('error', error.message);
          }
          this.logger.log('error', error.config);
          reject(error);
        });
    }); 
  }

  public getNextInvoiceNumber(idEmpresa: any, idFacturacion: any, tipo: string){
    return new Promise((resolve: any, reject: any) =>{
      //setTimeout(() => resolve(), N);
      var getNextInvReq = {
        "auth": this.auth,
        "service": {
          "provision": "Empresa",
          "operacion": "leer_talonario_co"
        },
        "parameters": {
          "sesion": {
            "usuario": this.colppyUsr,
            "claveSesion": this.currentKey
          },
          "idEmpresa": idEmpresa,
          "idTipoComprobante": tipo,
          "nroResolucion": idFacturacion
        }
      };

      this.makeHttpPost(this.endpoint, getNextInvReq)
        .then((response: any)=>{
          //var returnValue = response['data'].response.data.prefijo + '-' + response['data'].response.data.proximoNum;
          resolve({prefix: response['data'].response.data.prefijo, number: response['data'].response.data.proximoNum});
        })
        .catch((error: any)=>{
          reject(error);
        })


      
    });  
  }

  protected recordError(route, error, trxdate, creator, source){
    this.logger.log('error', error);
    //debemos marcar el registro como deshabilitado y crear el 
    //informe de error
    let fbRef = this.db.ref(route);
    fbRef.set(true);
    //he insertamos un registro en el log de errores
    const afList = this.db.ref('errors/' + creator);
    let errorToSave = {
      'error': error,
      'date': trxdate.getTime(),
      'operation': source,
    }
    afList.push().set(errorToSave);
  }
}