
const express = require('express');
const app = express();
const fs = require('fs');

const { createEventAdapter } = require('@slack/events-api');
const { WebClient } = require('@slack/web-api');
const { createMessageAdapter } = require('@slack/interactive-messages');

const chatbot = require('./chatbot');
const calendar = require('./google-calendar')
const faq = require('./faq');

const slackSigningSecret = process.env.SLACK_SIGNING_SECRET;
const slackEvents = createEventAdapter(slackSigningSecret);
const slackInteractions = createMessageAdapter(slackSigningSecret);
const port = process.env.PORT || 3000;
const token = process.env.SLACK_TOKEN;
const web = new WebClient(token);

app.use('/slack/events', slackEvents.expressMiddleware());
app.use('/slack/actions', slackInteractions.requestListener());
app.use(express.json());
app.use('/webhook', require('./webhook')(ask));

// Convert result from google-calendar to posted messages
function processResult(callback, result) {
  if (result.valid) {
    callback({text: result.data.map(r => `${r.title}, at ${r.start}   <${r.url}|[Calendar Link]>`).join('')});
  } else {
    callback({text: result.data});
  }
}

let new_date = null;
function check_validity(date, channelId, text, callback) {
  if (isNaN(date.getTime())) {
    new_date = callback;
    // date is not valid
    web.chat.postMessage({
      channel: channelId,
      blocks: [{
        "type": "section",
        "text": {
          "type": "plain_text",
          "text": text + "date not recognised. please select it from this calendar:"
        },
        "accessory": {
          "type": "datepicker",
          "action_id": "datepickeraction",
          "placeholder": {
            "type": "plain_text",
            "text": "Select a date",
          }
        }
      }]
    });
  } else {
    return callback(date)
  }
}

// listen for datepicker changing
slackInteractions.action({}, (payload, respond) => {
  const a = payload.actions[0]
  respond({text: "Processing with date " + a.selected_date});
  if (payload.type == "block_actions" && a.action_id == "datepickeraction") {
    new_date(a.selected_date);
    new_date = null;
  } else {
    web.chat.postMessage({channel: payload.channel.id, text: "Something updated..?"});
  }
})


function ask(text, callback) {
  faq.ask(text, (err, answer) => {
    if (err || !answer) {
      fs.readFile('./credentials.json', (err, content) => {
        if (err) {
          callback({text: "Error loading client secret file."});
          return console.log('Error loading client secret file:', err);
        }
        calendar.authorize(JSON.parse(content), (auth) => {
          const dates = chatbot.toJSDates(chatbot.getDates(text));
          if (dates.length) {
            if (dates.length == 1) {
              check_validity(dates[0], channelId, "", (d) => {
                let day = chatbot.dayBounds(d);
                calendar.getEvents(auth, day[0], day[1], r => processResult(callback, r));
              });

            } else if (dates.length == 2) {
              check_validity(dates[0], channelId, "first ", (d0) =>
                check_validity(dates[1], channelId, "second ", (d1) =>
                  calendar.getEvents(auth, d0, d1, r => processResult(callback, r)))
              );
            } else {
              callback({text: "Too many dates! I don't know what to do."});
            }
          } else {
            const eventNames = chatbot.getSubjects(text);
            // ^^ returns [ 'Visma traditional breakfast', 'Yoga session' ]
            calendar.getEventsByName(auth, eventNames[0], result => processResult(callback, result));
          }
        });
      });
    } else {
      callback(answer.answer);
    }
  });
}

// Attach listeners to events by Slack Event "type". See: https://api.slack.com/events/message.im
slackEvents.on('message', (event) => {
  if (event.channel_type != 'im') {
    return;
  }
  if (typeof event.bot_id != 'undefined' || typeof event.text == 'undefined')
  {
    return;
  }
  if (typeof event.text.length == 0)
  {
    return;
  }
  console.log(`message.im: ${event.text}`);
  const channelId = event.channel;
  ask(event.text, answer => web.chat.postMessage({ ...answer, channel: channelId }));
});

app.listen(port);
console.log(`Listening for events on ${port}`);
