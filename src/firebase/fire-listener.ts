import { IFireBizService } from '../interfaces/i-fire-biz-service';
import * as util from 'util';
import * as  winston from 'winston';

export class FireListener {

  private route: string;
  private service: IFireBizService;
  private db: any;
  private initialized: boolean = false;
  private inProgress: any = {};

  protected logger = new (winston.Logger)({
    transports: [
    new (winston.transports.Console)(),
    //new (winston.transports.File)({ filename: 'colppyTrx.log' })
    ]
  });

  constructor(route:string, db: any, service:IFireBizService){
    this.route =  route;
    this.db = db;
    this.service = service;
  }

  public initListener(){
    var ref = this.db.ref(this.route);
    var count = 0;
    //we create the listener for a change
    ref.on('child_changed', (snapshot: any) => {
      if(this.initialized && !this.inProgress[snapshot.key]){
        var param = snapshot.val();
        param.key = snapshot.key;
        this.inProgress[param.key] = true;
        //console.log('child_added' + util.inspect(param) );
        this.service.createBizObject(param)
          .then((liberatedKey)=>{
            delete this.inProgress[liberatedKey];
          })
          .catch(key=>{
            this.logger.log('error', 'failed to process ', util.inspect(param))
            delete this.inProgress[key];
          });
      }
    });

    //the the listener for a new element
    ref.on('child_added', (snapshot: any) => {
      count++;
      if(this.initialized){
        var param = snapshot.val();
        param.key = snapshot.key;
        this.inProgress[param.key] = true;
        //console.log('child_added' + util.inspect(param) );
        this.service.createBizObject(param)
          .then((liberatedKey)=>{
            delete this.inProgress[liberatedKey];
          })
          .catch(key=>{
            this.logger.log('error', 'failed to process ', util.inspect(param))
            delete this.inProgress[key];
          });
      }
    });

    //TODO still pending to solve a bug related to a double call when the systems starts and there's just one element
    ref.once('child_added', (snapshot: any) => {
      console.log('Se inicializo el listener ' + this.route + ' con ' + count + ' registros');
      this.initialized = true;
      if( count === 1){
        var param = snapshot.val();
        param.key = snapshot.key;
        this.inProgress[param.key] = true;
        this.service.createBizObject(param)
          .then((liberatedKey)=>{
            delete this.inProgress[liberatedKey];
          })
          .catch(key=>{
            this.logger.log('error', 'failed to process ', util.inspect(param))
            delete this.inProgress[key];
          });
      }
    });
  }










}
