import kakigori from './kakigori.js';
import takoyaki from './takoyaki.js';
import somen from './somen.js';
import tanabata from './tanabata.js';
import senko from './senko.js';
import matsuri from './matsuri.js';
import hanabi from './hanabi.js';
import suika from './suika.js';

// the week (Mon–Fri, ending in Friday's credits), then the days after
export const CHAPTERS = [kakigori, takoyaki, somen, tanabata, senko, matsuri, hanabi, suika];
export const WEEK = CHAPTERS.filter(c => c.day <= 5);
