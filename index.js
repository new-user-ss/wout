
import http from 'http'
import https from 'https'

import express from 'express'
import nodeFetch from 'node-fetch'



const clamp = (min, val, max) => Math.min(max, Math.max(min, val))
async function start(config, log = console.log) {
	const createAgent = () => {
		const options = {
			keepAlive     : true,
			maxFreeSockets: 10e3,
		}
		const ahttp  = new http .Agent({ ...options })
		const ahttps = new https.Agent({ ...options })

		return url => ( url.protocol === "https:" ) ? ahttps : ahttp
	}
	const fetchWrapper = async (url, options) => {
		const startTime = Date.now()
		let result, error
		try {
			result = await( await nodeFetch(url, options) ).json()
		} catch(e) {
			error = e
			///console.log( e.message )
		}
		const endTime = Date.now()
		return { duration: endTime - startTime, result, error }
	}
	const getSliceParams = options => {
		const offset = clamp(0, options?.offset|0, 1e9)
		const limit  = clamp(1, options?.limit|0 , 1e3)
		return `offset=${offset}&limit=${limit}`
	}

	const apiUrl = `${ config.api.protocol }//${ config.api.host }`
	const agent  = createAgent()

	const getMyDialogs     = options => fetchWrapper(`${apiUrl}/api/dialogs/?unread_first=1&${ getSliceParams(config?.operator?.limits?.dialog) }`, options)
	const getMessages      = options => fetchWrapper(`${apiUrl}/api/messages/?dialog_id=${ config?.operator?.dialog_id }&${ getSliceParams(config?.operator?.limits?.message) }`, options)
	const getNewLeadsCount = options => fetchWrapper(`${apiUrl}/api/leads/count_free/`, options)
	const createMessage    = options => fetchWrapper(`${apiUrl}/api/messages/`, options)

	const clientTick = async () => {
		const options = {
			headers: { 
				'connection'  : 'keep-alive',
				'content-type': 'application/json',
				'x-username'  : config?.operator?.operator,
			},
			agent,
		}
		
		const text = 'Test text!!!\n 2 line\n3line'
		return await Promise.all([
			getMyDialogs(options),
			getNewLeadsCount(options),
			getMessages(options),
			//createMessage({ ...options, body: JSON.stringify({ dialog, text, is_read: true, }), method: 'POST' })
		])
	}

	for(let i = 0; i < config.repeat; i++) {
		const result = await Promise.all( Array( config.operatorCount ).fill().map( clientTick ) )
		const logText = result
			.map((r, i) => `Client #${i} ` + [ 'MyLeads',  'NewLeadsCnt', 'Msgs', ]
				.map((name, i) => `[${name} ${ String(r[i].duration).padStart(6, ' ') }ms ${ r[i].error ? 'fail' : 'done' }]`)
				.join(' ') )
			.join('\n')

		log('####################################')
		log( logText )
	}
}

//////////////////////////////////////
//////////////////////////////////////
//////////////////////////////////////
//////////////////////////////////////






const options = {
	api: {
		protocol: 'https:',
		host    : 'binary.blackacornlabs.com:444',
		///host: 'bot.blackacornlabs.com',
	},
	
	operator: {
		operator: 'operator1',
		dialog_id: 719,
	
		limits: {
			dialog : { offset: 0, limit: 1, },
			message: { offset: 0, limit: 1, },
		},
	},
	
	operatorCount: 1,
	repeat: 10000,
}
//start(options)

const port = process.env.PORT || 3000


const app = express()

app.get('/', async (req, res) => {
	
	const operatorCount = clamp(1, req?.query?.operatorCount|0, 100)
	const repeat        = clamp(1, req?.query?.repeat|0       , 10 )
	const _options = { ...options, operatorCount, repeat, }

	const a = []
	const log = s => a.push(s)
	
	await start(_options, log)
	
	const text = a.map(s => s.trim()).join('\n')
	
	res.send(`<pre>${text}</pre>`)

});

app.listen( process.env.PORT || 3000, () => {
	console.log(`App available at http://localhost:${port}`);
})
