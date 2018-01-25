import { FireListener } from './fire-listener';
import * as admin from 'firebase-admin';
import { NewClientService } from '../accounting/new-client-service';
import { InvoiceService } from '../accounting/invoice-service';

import * as  winston from 'winston';

export class FireController{

  private listeners: FireListener[] = [];

  private serviceAccount = 'src/res/TrotaloProd-853421c005ab.json';

  private logger = new (winston.Logger)({
    transports: [
      new (winston.transports.Console)(),
      //new (winston.transports.File)({ filename: 'somefile.log' })
    ]
  });

  constructor(){
    //first we initialize the
    this.initFirebaseConnection();
    this.listeners.push(new FireListener('accounting/clients', admin.database(), new NewClientService()));
    this.listeners.push(new FireListener('accounting/invoices', admin.database(), new InvoiceService()));
    /*this.listeners.push(new FireListener('camicase2'));
    this.listeners.push(new FireListener('camicase3'));
    this.listeners.push(new FireListener('camicase4'));*/

    
  }

  private initFirebaseConnection(){
    this.logger.log('info', 'Starting firebase connection!');

    admin.initializeApp({
      credential: admin.credential.cert(this.serviceAccount),
      databaseURL: 'https://trotaloprod.firebaseio.com'
    });
  }

  public initListeners(){
    this.listeners.forEach(currentValue=>{
      currentValue.initListener();
    })
  }
  
}