module.exports = (ask) => {
  return (req, res, next) => {
    var clump = req.body;
    var question = clump["intent"]["query"];
    console.log(`Got webhook question ${question}`);
    ask(question, function (answer) {
      console.log(`Answering webhook with ${answer.text}`);
      res.status(200);
      var msg = {
        'prompt': {
          'override': true,
          'firstSimple': {
            'speech': answer.text,
            'text': answer.text
          }
        }
      };
      res.json(msg);
      next();
    });
  };
};
