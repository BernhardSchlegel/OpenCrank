import { renderChart, totalDurationSec } from '../components/power-chart';
import type { Training } from '../components/power-chart';
import { getFtp } from './settings';
import { selectTraining } from '../state/session';
import trainingsData from '../data/trainings.json';

const trainings = trainingsData as Training[];

function formatDuration(seconds: number): string {
  const m = Math.round(seconds / 60);
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m} min`;
}

export function init(container: HTMLElement): void {
  const list = container.querySelector<HTMLElement>('#training-list')!;
  const ftp = getFtp();

  for (const training of trainings) {
    const dur = totalDurationSec(training.steps);

    const card = document.createElement('div');
    card.className = 'training-card';
    card.innerHTML = `
      <div class="training-card-header">
        <div class="training-card-title">${training.name}</div>
        <div class="training-card-meta">~${formatDuration(dur)}</div>
      </div>
      <div class="training-card-desc">${training.description}</div>
      <div class="training-chart-wrap"></div>
      <button class="btn btn-primary training-start-btn">SELECT</button>
    `;

    renderChart(card.querySelector<HTMLElement>('.training-chart-wrap')!, training, ftp);

    card.querySelector('.training-start-btn')!.addEventListener('click', () => {
      selectTraining(training);
      location.hash = 'home';
    });

    list.appendChild(card);
  }
}
