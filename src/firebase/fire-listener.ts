import { IFireBizService } from '../interfaces/i-fire-biz-service';
import * as util from 'util';

export class FireListener {

  private route: string;
  private service: IFireBizService;
  private db;
  private initialized: boolean = false;

  constructor(route:string, db, service:IFireBizService){
    this.route =  route;
    this.db = db;
    this.service = service;
  }

  //TODO generar un mapa para evitar reproceso de elementos editados
  public initListener(){
    var ref = this.db.ref(this.route);
    var count = 0;
    //we create the listener for a change
    ref.on('child_changed', (snapshot) => {
      if(this.initialized){
        var param = snapshot.val();
        param.key = snapshot.key;
        console.log('child_added' + util.inspect(param) );  
        this.service.createBizObject(param);
      }
    });

    //the the listener for a new element
    ref.on('child_added', (snapshot) => {
      count++;
      if(this.initialized){
        var param = snapshot.val();
        param.key = snapshot.key;
        console.log('child_added' + util.inspect(param) );
        this.service.createBizObject(param);
      }
    });
    
    ref.once('child_added', (snapshot) => {
      console.log('Se inicializo el listener ' + this.route + ' con ' + count + ' registros');
      this.initialized = true;
      if( count === 1){
        var param = snapshot.val();
        param.key = snapshot.key;
        this.service.createBizObject(param); 
      }
      //this.service.createBizObject(param);
    });
  }

  



  



  
}

