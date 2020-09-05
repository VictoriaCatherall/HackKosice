const nlp = require('compromise');
const number = require('compromise-number');
const dates = require('compromise-dates');

nlp.extend(number);
nlp.extend(dates);

function getNouns(text) {
  const doc = nlp(text);
  return doc.nouns().json();
}

function getVerbs(text) {
  const doc = nlp(text);
  return doc.verbs().json();
}

function getDates(text) {
  const doc = nlp(text);
  return doc.dates().json();
}

module.exports = {
  getNouns,
  getVerbs,
  getDates
};
