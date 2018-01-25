import { FireController } from './firebase/fire-controller'
import * as express from 'express';
import axios from 'axios';
import * as  winston from 'winston';

class Server{

    private value:string;
    private fireController: FireController;
    private herokuEnpodint: string = 'https://boiling-ocean-33652.herokuapp.com/';

    protected logger = new (winston.Logger)({
        transports: [
        new (winston.transports.Console)(),
        //new (winston.transports.File)({ filename: 'colppyTrx.log' })
        ]
    });

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

        //finally we set a pinger to keep service online
        setInterval(()=>{
            axios.get(this.herokuEnpodint)
                .then((response)=>{
                    this.logger.log('debug', 'ping response arrived!');
                });

        }, 3000000);
    }
}

let server: Server = new Server();

//app.printHelloWorlds('papayon');
server.start();
server.startWebServer();
