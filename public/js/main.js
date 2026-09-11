// FRONT-END (CLIENT) JAVASCRIPT HERE

// id of the row being edited
let editing = null

const load = async function () {
  const [me, response] = await Promise.all([fetch('/api/me'), fetch('/api/data')])

  // session expired or missing: back to the login page
  if (response.status === 401) return location.replace('/login.html')

  document.querySelector('#username').textContent = (await me.json()).username
  render(await response.json())
}

const render = function (data) {
  const list = document.querySelector('#list')

  list.innerHTML = ''
  data.forEach(function (row) {
    list.appendChild(cardFor(row))
  })
}

const cardFor = function (row) {
  const card = document.createElement('article')

  const header = document.createElement('header')
  header.className = 'card__header'

  const title = document.createElement('h2')
  title.className = 'card__title'
  title.textContent = row.theory

  const actions = document.createElement('div')
  actions.className = 'card__actions'

  const edit = document.createElement('button')
  edit.className = 'outline'
  edit.type = 'button'
  edit.textContent = 'Edit'
  edit.onclick = function () {
    startEdit(row)
  }

  const del = document.createElement('button')
  del.className = 'outline secondary'
  del.type = 'button'
  del.textContent = 'Delete'
  del.setAttribute('aria-label', 'Delete ' + row.theory)
  del.dataset.id = row.id
  del.onclick = remove

  actions.append(edit, del)
  // only the owner gets edit / delete
  actions.hidden = !row.mine

  header.append(title, actions)

  const verdict = document.createElement('p')
  verdict.className = 'verdict verdict--' + row.verdict.toLowerCase()
  verdict.textContent = row.verdict

  const meter = document.createElement('progress')
  meter.max = 100
  meter.value = row.exposureOdds * 100
  meter.setAttribute('aria-label', 'Chance the conspiracy has leaked')

  card.append(
    header,
    verdict,
    line('posted by ' + row.username),
    line(row.conspirators.toLocaleString() + ' conspirators'),
    line(row.yearsRunning + ' years running'),
    meter,
    line((row.exposureOdds * 100).toFixed(1) + '% chance it has leaked'),
    line('expected reveal in ' + formatYears(row.yearsUntilExposed))
  )

  return card
}

const line = function (text) {
  const p = document.createElement('p')
  p.className = 'card__line'
  p.textContent = text

  return p
}

const formatYears = function (years) {
  if (years < 1) return Math.round(years * 12) + ' months'
  if (years < 1000) return years.toFixed(1) + ' years'

  return Math.round(years).toLocaleString() + ' years'
}

const openDialog = function () {
  document.querySelector('#entryDialog').showModal()
  document.querySelector('#theory').focus()
}

const startEdit = function (row) {
  editing = row.id

  document.querySelector('#theory').value = row.theory
  document.querySelector('#conspirators').value = row.conspirators
  document.querySelector('#yearsRunning').value = row.yearsRunning
  document.querySelector('#formTitle').textContent = 'Edit Conspiracy'
  document.querySelector('#submit').textContent = 'Save Changes'
  openDialog()
}

const remove = async function (event) {
  const response = await fetch('/api/delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: event.target.dataset.id })
  })

  render(await response.json())
}

const submit = async function (event) {
  // stop form submission from trying to load
  // a new .html page for displaying results...
  // this was the original browser behavior and still
  // remains to this day
  event.preventDefault()

  const theory = document.querySelector('#theory'),
    conspirators = document.querySelector('#conspirators'),
    yearsRunning = document.querySelector('#yearsRunning')

  const json = {
    theory: theory.value,
    conspirators: Number(conspirators.value),
    yearsRunning: Number(yearsRunning.value)
  }

  if (editing !== null) json.id = editing

  const response = await fetch(editing === null ? '/api/add' : '/api/edit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(json)
  })

  render(await response.json())
  reset()
}

const reset = function () {
  editing = null

  document.querySelector('#entryForm').reset()
  document.querySelector('#formTitle').textContent = 'New Conspiracy'
  document.querySelector('#submit').textContent = 'Add Conspiracy'
  document.querySelector('#entryDialog').close()
}

window.onload = function () {
  document.querySelector('#newBtn').onclick = function () {
    reset()
    openDialog()
  }
  document.querySelector('#cancel').onclick = reset
  document.querySelector('#entryForm').onsubmit = submit

  // the server sends new accounts here with ?created=1
  if (new URLSearchParams(location.search).get('created') === '1') {
    document.querySelector('#created').hidden = false
    history.replaceState(null, '', '/')
  }

  load()
}
