
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

const dateSelectBlocks = [
  {
    "type": "section",
    "text": {
      "type": "plain_text",
      "text": "Date not recognised. Please select it from this calendar:"
    },
    "accessory": {
      "type": "datepicker",
      "action_id": "datepickeraction",
      "placeholder": {
        "type": "plain_text",
        "text": "Select a date",
      }
    }
  }
];

// Convert result from google-calendar to posted messages
function postEvents(callback, events) {
  callback({text: events.map(r => `${r.summary}, at ${r.start.dateTime}   <${r.htmlLink}|Add to calendar>`).join('')});
}

function getEventsOutputHandler(callback) {
  return (err, events) => {
    if (err) {
      callback({text: 'BIG ERROR probaly with google calendar api'});
    } else {
      if (events.length) {
        postEvents(events);
      } else {
        callback({text: 'No events found for this date range.'});
      }
    }
  };
}

let new_date = null;
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
              if (isNaN(dates[0].getTime())) {
                callback({text: 'Date not recognised', blocks: dateSelectBlocks});
              } else {
                let day = chatbot.dayBounds(d);
                calendar.getEvents(auth, day[0], day[1], getEventsOutputHandler(callback));
              }
            } else if (dates.length == 2) {
              if (isNaN(dates[0].getTime()) || isNaN(dates[1].getTime())) {
                callback({text: 'Date not recognised', blocks: dateSelectBlocks});
              } else {
                calendar.getEvents(auth, dates[0], dates[1], getEventsOutputHandler(callback));
              }
            } else {
              callback({text: "Too many dates! I don't know what to do."});
            }
          } else {
            const eventNames = chatbot.getSubjects(text);
            // ^^ returns [ 'Visma traditional breakfast', 'Yoga session' ]
            calendar.getEventsByName(auth, eventNames[0], getEventsOutputHandler(callback));
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
