const nlp = require('compromise');
const numbers = require('compromise-numbers');
const dates = require('compromise-dates');

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

module.exports = {
  getNouns,
  getVerbs,
  getDates
};

if (require.main == module) {
  console.log(nlp(process.argv[2]).nouns().adjectives().json());
}
