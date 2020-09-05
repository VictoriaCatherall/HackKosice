const nlp = require('compromise');

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
