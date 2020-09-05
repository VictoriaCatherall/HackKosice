// example from
// https://github.com/slackapi/node-slack-sdk
// cut

// https://slack.dev/node-slack-sdk/events-api

const { createEventAdapter } = require('@slack/events-api');
const slackSigningSecret = process.env.SLACK_SIGNING_SECRET;
const slackEvents = createEventAdapter(slackSigningSecret);
const port = process.env.PORT || 3000;

// Attach listeners to events by Slack Event "type". See: https://api.slack.com/events/message.im
slackEvents.on('message', (event) => {
  if (event.channel_type != 'im') {
    return;
  }
  console.log('message.im');
  console.log(event);
});

(async () => {
  const server = await slackEvents.start(port);
  console.log(`Listening for events on ${server.address().port}`);
})();

