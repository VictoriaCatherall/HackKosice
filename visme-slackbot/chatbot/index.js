const nlp = require('compromise');
const numbers = require('compromise-numbers');
const dates = require('compromise-dates');
const SugarDate = require('sugar-date').Date;

nlp.extend(numbers);
nlp.extend(dates);

nlp.extend((Doc, world) => {
  world.postProcess(doc => {
    doc.match('Visma').tag('#Adjective');
  });
});

function getNouns(text) {
  const doc = nlp(text);
  return doc.nouns();
}

function getVerbs(text) {
  const doc = nlp(text);
  return doc.verbs();
}

function getSubjects(text) {
  const nouns = getNouns(text);
  return `${nouns.adjectives().text()} ${nouns.text()}`;
}

const commas = [ 'from', 'to', 'until', 'till', 'on', 'at' ];

function makeRegExpOr(arr) {
  return new RegExp('\\b(' + arr.join('|') + ')\\b', 'ig');
}

function getDates(text) {
  const preprocessed = text.replace(makeRegExpOr(commas), ', ');
  const doc = nlp(preprocessed);
  return doc.dates();
}

function toJSDates(dates) {
  const datesTexts = dates.out('array').map(dateText => dateText.replace(/\W+$/, ''));
  const result = datesTexts.map(dateText => SugarDate.create(dateText));
  return result;
}

SugarDate.extend();

function previousMidnight(jsDate) {
  return new Date(jsDate).reset('day');
}

function succeedingMidnight(jsDate) {
  return new Date(jsDate).addDays(1).reset('day');
}

function dayBounds(jsDate) {
  return [ previousMidnight(jsDate), succeedingMidnight(jsDate) ];
}

module.exports = {
  getNouns,
  getVerbs,
  getDates,
  dayBounds
};

if (require.main == module) {
  console.log(getSubjects('I would like to attend the Visma traditional breakfast'));
}

