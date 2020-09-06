module.exports = (ask) => {
  return (req, res, next) => {
    console.log('incoming webhook');
    var clump = JSON.parse(req.body);
    var question = clump["intent"]["query"];
    ask(question, function (answer) {
      res.status(200);
      var msg = {
        'prompt': {
          'override': true,
          'firstSimple': {
            'speech': answer,
            'text': answer
          }
        }
      };
      res.send(msg);
      next();
    });
  };
};
