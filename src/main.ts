import { initRouter } from './router';
import { init as initHome } from './pages/home';
import { init as initTraining } from './pages/training';
import { init as initSettings } from './pages/settings';

initHome(document.getElementById('page-home')!);
initTraining(document.getElementById('page-training')!);
initSettings(document.getElementById('page-settings')!);
initRouter();
