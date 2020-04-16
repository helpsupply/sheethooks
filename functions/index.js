const functions = require('firebase-functions');
const {GoogleAuth} = require('google-auth-library');
const {promisify} = require('util');

const CONFIG_SHEET = process.env.CONFIG_SHEET || functions.config().sheet.config_id;
const SHEETS_API = 'https://sheets.googleapis.com/v4/spreadsheets/';

async function getSheets(client, id) {
	return (await client.request({
		url: SHEETS_API + id
	})).data.sheets.map((s) => s.properties.title);
}

async function getSheetValues(client, id, sheetNames) {
	let params = sheetNames.map((s) => 'ranges=' + s).join('&');
	let ranges = (await client.request({
		url: SHEETS_API + id + '/values:batchGet?' + params
	})).data.valueRanges;

	let out = {};
	ranges.map((r, i) => {
		out[sheetNames[i]] = r.values;
		return null;
	});

	return out;
}

function gridToRecords(grid) {
	let out = [];
	grid.slice(1).map((row) => {
		let outRow = {};
		row.map((col, i) => {
			let prop = grid[0][i];
			if (prop) {
				outRow[prop] = col;
			}
		});
		out.push(outRow);
	});
	return out;
}

async function appendRow(client, id, sheet, row) {
	let result = (await client.request({
		url: SHEETS_API + id + '/values/' + sheet + '!A1:append',
		method: 'POST',
		params: {
			valueInputOption: 'USER_ENTERED',
			insertDataOption: 'INSERT_ROWS'
		},
	        data: {
			range: sheet + '!A1',
			values: [row]
		}
	}));
}

exports.hook = functions.https.onRequest(async (request, response) => {
  if (request.get('content-type') !== 'application/json') {
    response.status(400).send("{'error': 'content_type_header_not_json'}");
    return;
  }

  // Get the hook name from the URL
  console.log(request)
  let hookName = request.path.slice(1);

  // Setup google auth (this pulls from a service account json at env.GOOGLE_APPLICATION_CREDENTIALS)
  const auth = new GoogleAuth({
	scopes: 'https://www.googleapis.com/auth/spreadsheets'
  });
  const client = await auth.getClient();
  const projectId = await auth.getProjectId();

  let values = await getSheetValues(client, CONFIG_SHEET, ['Main']);
  let hooks = gridToRecords(values['Main']);

  // Find the matching hook
  let target = {}
  hooks.map((h) => {
    if (h['Hook Name'] === hookName) {
      target.sheet = h['Sheet ID'];
      target.token = h['Webhook Auth Token'];
    }
  });

  if (!target.sheet) {
    response.status(404).send("{'error': 'not_found'}");
    return;
  }

  // Check auth
  if (request.get('x-auth-token') !== target.token && request.query.token !== target.token) {
    response.status(401).send("{'error': 'bad_auth'}");
    return;
  }

  // Pull out the sheet from the request body
  let newRow = [];
  values = await getSheetValues(client, target.sheet, [request.body.sheet]);
  values[request.body.sheet][0].map((c) => {
    newRow.push('' + (request.body[c] || ''));
    return null;
  });

  // Actually append the row
  await appendRow(client, target.sheet, request.body.sheet, newRow);

  response.send('OK');

});
 
exports.describe = functions.https.onRequest(async (request, response) => {
  // Get the hook name from the URL
  console.log(request)
  let hookName = request.path.slice(1);

  // Setup google auth (this pulls from a service account json at env.GOOGLE_APPLICATION_CREDENTIALS)
  const auth = new GoogleAuth({
	scopes: 'https://www.googleapis.com/auth/spreadsheets'
  });
  const client = await auth.getClient();
  const projectId = await auth.getProjectId();

  // Get all hooks
  let values = await getSheetValues(client, CONFIG_SHEET, ['Main']);
  let hooks = gridToRecords(values['Main']);

  // Find the matching hook
  let target = {}
  hooks.map((h) => {
    if (h['Hook Name'] === hookName) {
      target.sheet = h['Sheet ID'];
      target.token = h['Webhook Auth Token'];
    }
  });

  if (!target.sheet) {
    response.status(404).send("{'error': 'not_found'}");
    return;
  }

  // Check auth
  if (request.get('x-auth-token') !== target.token && request.query.token !== target.token) {
    response.status(401).send("{'error': 'bad_auth'}");
    return;
  }

  // Get the values from the sheet and return the top rows
  let sheetNames = await getSheets(client, target.sheet);
  values = await getSheetValues(client, target.sheet, sheetNames);

  let schema = {};
  sheetNames.map((s) => {
    if (values[s] !== undefined) {
      schema[s] = values[s][0];
    }
    return null;
  });

  response.send(JSON.stringify(schema));
});
 
