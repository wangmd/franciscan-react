const express = require('express')
const next = require('next')
const LRUCache = require('lru-cache')

const port = parseInt(process.env.PORT, 10) || 3000
const dev = process.env.NODE_ENV !== 'production'
const app = next({
  dir: '.',
  dev
})
const handle = app.getRequestHandler()

const translationObj = {
  faculty: { page: '/faculty', type: 'faculty' },
  contact: { page: '/directory' },
  news: { page: '/news' },
  major: { page: '/major' },
  minor: { page: '/minor' },
  department: { page: '/department' },
  economics: { page: '/major', id: { default: 'economics' } },
  accounting: { page: '/major', id: { default: 'accounting' } },
  'comm-arts': { page: '/minor', id: { 'film-studies': 'film-studies-minor' } },
  associate: { page: '/associate', id: { default: 'main' } },
  hr: { page: '/page', type: 'humanResources' },
  'campus-security': { page: '/page', type: 'campusSecurity' },
  studentprofiles: { page: '/faculty', type: 'studentProfilePages' }
}

// This is where we cache our rendered HTML pages
const ssrCache = new LRUCache({
  max: 100,
  maxAge: dev ? 5 : 1000 * 60 * 60 // 1hour
})

app.prepare().then(() => {
  const server = express()

  // Use the `renderAndCache` utility defined below to serve pages
  server.get('/', (req, res) => renderAndCache(req, res, '/'))

  // universal Route
  server.get('/:type/:id?', (req, res, next) => {
    if (req.params.type !== '_next') {
      let type = null
      if (req.params.type) {
        type = `${req.params.type}Pages`
        if (translationObj[req.params.type]) {
          if (translationObj[req.params.type].type) {
            type = translationObj[req.params.type].type
          }
        } else {
          return renderAndCache(req, res, '/page', {
            id: req.params.id,
            type: `${req.params.type}Pages`
          })
        }
      }
      let id = null
      if (req.params.id) {
        if (translationObj[req.params.type].id) {
          if (translationObj[req.params.type].id[req.params.id]) {
            id = translationObj[req.params.type].id[req.params.id]
          }
        } else {
          id = req.params.id
        }
      } else {
        if (translationObj[req.params.type].id) {
          if (translationObj[req.params.type].id.default) {
            id = translationObj[req.params.type].id.default
          }
        }
      }
      let page = '/page'
      if (translationObj[req.params.type]) {
        if (translationObj[req.params.type].page) {
          page = translationObj[req.params.type].page
        }
      }
      let options = {}
      if (id) {
        options.id = id
      }
      if (type) {
        options.type = type
      }
      // console.log('type:', type)
      // console.log('id:', id)
      // console.log('page:', page)
      // console.log('options:', options)
      return renderAndCache(req, res, page, options)
    }
    return handle(req, res)
  })

  server.get('*', (req, res) => {
    return handle(req, res)
  })

  server.listen(port, err => {
    if (err) throw err
    console.log(`> Ready on http://localhost:${port}`)
  })
})

/*
 * NB: make sure to modify this to take into account anything that should trigger
 * an immediate page change (e.g a locale stored in req.session)
 */
function getCacheKey (req) {
  return `${req.url}`
}

function renderAndCache (req, res, pagePath, queryParams) {
  const key = getCacheKey(req)

  // If we have a page in the cache, let's serve it
  if (ssrCache.has(key)) {
    console.log(`CACHE HIT: ${key}`)
    res.send(ssrCache.get(key))
    return
  }

  // If not let's render the page into HTML
  app
    .renderToHTML(req, res, pagePath, queryParams)
    .then(html => {
      // Let's cache this page
      console.log(`CACHE MISS: ${key}`)
      ssrCache.set(key, html)

      res.send(html)
    })
    .catch(err => {
      app.renderError(err, req, res, pagePath, queryParams)
    })
}
