const https = require('https');

const threshold = 50;

function ask(question, callback) {
  const data = JSON.stringify({ question });

  const options = {
    hostname: 'hackkk.azurewebsites.net',
    port: 443,
    path: '/qnamaker/knowledgebases/f4181451-4acd-4bb9-9a93-4a7c16af2439/generateAnswer',
    method: 'POST',
    headers: {
      'Authorization': 'EndpointKey 5eb0c8e2-8b4b-4ea9-b2ce-b05e3604bb7c',
      'Content-Type': 'application/json',
      'Content-Length': data.length
    }
  };

  const req = https.request(options, (res) => {
    let body = '';
    res.on('data', (d) => {
      body += d;
    });
    res.on('end', () => {
      try {
        const answer = JSON.parse(body).answers[0];
        if (answer.answer == 'No good match found in KB.' || answer.score < threshold) {
          callback(new Error('You must find the answer within yourself'));
        } else {
          callback(null, answer);
        }
      } catch (e) {
        callback(e);
      }
    });
  });

  req.on('error', (error) => {
    callback(error);
  })

  req.write(data);
  req.end();
}

module.exports = {
  ask
};

if (require.main == module) {
  ask(process.argv[2], console.log);
}
