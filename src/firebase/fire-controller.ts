import { FireListener } from './fire-listener';
import { IFireListener } from '../interfaces/i-fire-listener';
import { ComposedListener } from './composed-listener';
import * as admin from 'firebase-admin';
import { NewClientService } from '../accounting/new-client-service';
import { NewProviderService } from '../accounting/new-provider-service';
import { InvoiceService } from '../accounting/invoice-service';
import { NewPaymentService } from '../accounting/new-payment-service';

import { Enviroment } from '../enviroment/enviroment';

import * as  winston from 'winston';

export class FireController{

  private listeners: IFireListener[] = [];

  //development
  //private serviceAccount = 'src/res/TrotaloProd-853421c005ab.json';

  //prod
  private serviceAccount = Enviroment.SYS_CONFIG.serviceAccount;

  //development
  //private url: string = 'https://trotaloprod.firebaseio.com';

  //prod
  private url: string = Enviroment.SYS_CONFIG.fbUrl;


  private logger = new (winston.Logger)({
    transports: [
      new (winston.transports.Console)(),
      //new (winston.transports.File)({ filename: 'somefile.log' })
    ]
  });

  constructor(){
    //first we initialize the
    this.initFirebaseConnection();
    /*this.listeners.push(new FireListener('accounting/clients', admin.database(), new NewClientService()));
    this.listeners.push(new FireListener('accounting/invoices', admin.database(), new InvoiceService()));*/

    this.listeners.push(new ComposedListener('accounting/clients', admin.database(), NewClientService));
    this.listeners.push(new ComposedListener('accounting/providers', admin.database(), NewProviderService));
    this.listeners.push(new ComposedListener('accounting/invoices', admin.database(), InvoiceService));
    this.listeners.push(new ComposedListener('accounting/payments', admin.database(), NewPaymentService));

    //this.logger.log('info', 'Connected to: ', this.serviceAccount);
    /*this.listeners.push(new FireListener('camicase2'));
    this.listeners.push(new FireListener('camicase3'));
    this.listeners.push(new FireListener('camicase4'));*/


  }

  private initFirebaseConnection(){
    this.logger.log('info', 'Starting firebase connection!', this.serviceAccount, this.url);

    admin.initializeApp({
      credential: admin.credential.cert(this.serviceAccount),
      databaseURL: this.url
    });
  }

  public initListeners(){
    this.listeners.forEach(currentValue=>{
      currentValue.initListener();
    })
  }

}
