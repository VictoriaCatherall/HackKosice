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

function getDates(text) {
  const doc = nlp(text);
  return doc.dates();
}

function toJSDates(dates) {
  const datesTexts = dates.text().split(/, /g);
  const result = datesTexts.map(dateText => SugarDate.create(dateText));
  return result;
}

module.exports = {
  getNouns,
  getVerbs,
  getDates
};

if (require.main == module) {
  console.log(toJSDates(getDates(process.argv[2])));
}
