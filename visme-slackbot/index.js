
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
function postEvents(postMessage, events) {
  console.log(events)
  postMessage({text: events.map(r => `${r.summary}, at ${r.start.dateTime || r.start.date}   <${r.htmlLink}|Add to calendar>`).join('\n')});
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

function ask(text, postMessage) {
  faq.ask(text, (err, answer) => {
    if (err || !answer) {
      fs.readFile('./credentials.json', (err, content) => {
        if (err) {
          postMessage({text: "Error loading client secret file."});
          return console.error('Error loading client secret file:', err);
        }
        calendar.authorize(JSON.parse(content), (auth) => {
          const dates = chatbot.toJSDates(chatbot.getDates(text));
          const eventNames = chatbot.getSubjects(text);
          if (dates.length) {
            let start, end;
            if (dates.length == 1) {
              if (isNaN(dates[0].getTime())) {
                postMessage({text: 'Date not recognised', blocks: dateSelectBlocks});
                return;
              } else {
                [start, end] = chatbot.dayBounds(dates[0]);
              }
            } else if (dates.length == 2) {
              if (isNaN(dates[0].getTime()) || isNaN(dates[1].getTime())) {
                postMessage({text: 'Date not recognised', blocks: dateSelectBlocks});
                return;
              } else {
                [start, end] = dates;
              }
            } else {
              postMessage({text: "Too many dates! I don't know what to do."});
              return;
            }
            console.log(start, end);
            calendar.getEvents(auth, start, end, (err, events) => {
              if (err) {
                console.error('BIG ERROR probaly with google calendar api', err);
              } else {
                if (events.length) {
                  postEvents(postMessage, events);
                } else {
                  postMessage({text: 'No events found for this date range.'});
                }
              }
            });
          } else if (eventNames.length) {
            console.log(eventNames);
            let found = false;
            for (const eventName of eventNames) {
              calendar.getEventsByName(auth, eventName, (err, events) => {
                if (err) {
                  console.error('Error with google calendar api', err);
                  return;
                }
                if (events.length) {
                  postEvents(postMessage, events);
                  found = true;
                }
              });
            }
            if (!found) {
              postMessage({text: 'No events found'});
            }
          } else {
            postMessage({text: 'What are you trying to do ....'});
          }
        });
      });
    } else {
      postMessage({mrkdwn: true, text: answer.answer});
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
