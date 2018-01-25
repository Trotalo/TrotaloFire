import { FireController } from './firebase/fire-controller'

class Server{

    private value:string;
    private fireController: FireController;

    constructor(){
        this.value = 'testing!';
        this.fireController = new FireController();
    }        

    public start(){
        this.fireController.initListeners();
    }

    public printHelloWorlds(val?:string){
        console.log('Hola mundo!' + this.value + ' ' + val);        
    }
}

let server: Server = new Server();

//app.printHelloWorlds('papayon');
server.start();
