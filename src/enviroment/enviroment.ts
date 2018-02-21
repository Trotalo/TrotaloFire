

export class Enviroment{

  private static prod = false;

  private static development = {
    colppyUsr: 'suesca@trotalo.com',
    colppyPassw: '18a8875833adddc536589743c708f964',
    herokuEnpodint: 'https://boiling-ocean-33652.herokuapp.com/',
    serviceAccount: 'src/res/TrotaloProd-853421c005ab.json',
    fbUrl: 'https://trotaloprod.firebaseio.com'
  };

  private static production = {
    colppyUsr: 'suesca@trotalo.com',
    colppyPassw: '18a8875833adddc536589743c708f964',
    herokuEnpodint: 'https://boiling-ocean-33652.herokuapp.com/',
    serviceAccount: 'src/res/trotalococulta-firebase-adminsdk-j5gfb-9fd7e71287.json',
    fbUrl: 'https://trotalococulta.firebaseio.com'
  };

  public static SYS_CONFIG = (Enviroment.prod? Enviroment.production : Enviroment.development);


}
