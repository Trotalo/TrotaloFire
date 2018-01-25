import { FireController } from './firebase/fire-controller'
import * as express from 'express';

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

    public startWebServer(){
        var app = express();
        var port = parseInt(process.env.PORT, 10) || 5000;
        app.set("port", port);
        app.get("/", function(request, response) {
          response.send("Hello World!");
        });
        app.listen(port, function() {
          console.log("Node app is running at localhost:" + port);
        });
    }
}

let server: Server = new Server();

//app.printHelloWorlds('papayon');
server.start();
server.startWebServer();
