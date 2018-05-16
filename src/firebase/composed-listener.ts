import { IFireBizService } from '../interfaces/i-fire-biz-service';
import { FireListener } from './fire-listener';
import { IFireListener } from '../interfaces/i-fire-listener';
import * as util from 'util';
import * as  winston from 'winston';

export class ComposedListener implements IFireListener {

  private route: string;
  private innerService;
  private db: any;
  private initialized: boolean = false;
  //private inProgress: any = {};
  inProgress: string;

  protected logger = new (winston.Logger)({
    transports: [
    new (winston.transports.Console)(),
    //new (winston.transports.File)({ filename: 'colppyTrx.log' })
    ]
  });

  constructor(route:string, db: any, innerService){
    this.route =  route;
    this.db = db;
    this.innerService = innerService;
  }

  public initListener(){
    var ref = this.db.ref(this.route);
    var count = 0;
    //the the listener for a new element
    ref.on('child_added', (snapshot: any) => {
      count++;
      let msgProcessor = new this.innerService();
      let listener = new FireListener(this.route + '/' +  snapshot.key, this.db, msgProcessor);
      listener.initListener();

    });

    //TODO still pending to solve a bug related to a double call when the systems starts and there's just one element
    ref.once('child_added', (snapshot: any) => {
      console.log('Se inicializo el listener ' + this.route + ' con ' + count + ' registros');
      this.initialized = true;
    });
  }










}
