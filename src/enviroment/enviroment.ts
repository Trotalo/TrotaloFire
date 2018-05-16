

export class Enviroment{

  private static prod = true;

  private static development = {
    colppyUsr: 'suesca@trotalo.com',
    colppyPassw: '18a8875833adddc536589743c708f964',
    herokuEnpodint: 'https://boiling-ocean-33652.herokuapp.com/',
    serviceAccount: 'src/res/trotalodev-c281e-firebase-adminsdk-gsl5l-4f9786bd91.json',
    fbUrl: 'https://trotalodev-c281e.firebaseio.com'
  };

  private static production = {
    colppyUsr: 'suesca@trotalo.com',
    colppyPassw: '18a8875833adddc536589743c708f964',
    herokuEnpodint: 'https://boiling-ocean-33652.herokuapp.com/',
    serviceAccount: 'src/res/trotaloprod-3e150-firebase-adminsdk-537v4-fc4426327e.json',
    fbUrl: 'https://trotaloprod-3e150.firebaseio.com'
  };

  //public static SYS_CONFIG = (Enviroment.prod? Enviroment.production : Enviroment.development);
  public static SYS_CONFIG = Enviroment.development;


}
