// FRONT-END (CLIENT) JAVASCRIPT HERE

// id of the row being edited
let editing = null

const load = async function () {
  const response = await fetch('/api/data')
  const data = await response.json()

  render(data)
}

const render = function (data) {
  const list = document.querySelector('#list')

  list.innerHTML = ''
  data.forEach(function (row) {
    list.appendChild(cardFor(row))
  })
}

const cardFor = function (row) {
  const li = document.createElement('li')
  li.className = 'card'
  
  
  const actions = document.createElement('div')
  actions.className = 'card__actions'

  const edit = document.createElement('button')
  edit.className = 'card__edit'
  edit.type = 'button'
  edit.textContent = 'Edit'
  edit.onclick = function () {
    startEdit(row)
  }

  const del = document.createElement('button')
  del.className = 'card__delete'
  del.type = 'button'
  del.textContent = 'X'
  del.dataset.id = row.id
  del.onclick = remove

  actions.append(edit, del)

  const title = document.createElement('h2')
  title.className = 'card__title'
  title.textContent = row.theory

  const verdict = document.createElement('p')
  verdict.className = 'verdict verdict--' + row.verdict.toLowerCase()
  verdict.textContent = row.verdict

  const meter = document.createElement('div')
  meter.className = 'meter'

  const fill = document.createElement('div')
  fill.className = 'meter__fill'
  fill.style.width = (row.exposureOdds * 100).toFixed(1) + '%'
  meter.appendChild(fill)

  li.append(
    actions,
    title,
    verdict,
    line(row.conspirators.toLocaleString() + ' conspirators'),
    line(row.yearsRunning + ' years running'),
    meter,
    line((row.exposureOdds * 100).toFixed(1) + '% chance it has leaked'),
    line('expected reveal in ' + formatYears(row.yearsUntilExposed))
  )

  return li
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

const startEdit = function (row) {
  editing = row.id

  document.querySelector('#theory').value = row.theory
  document.querySelector('#conspirators').value = row.conspirators
  document.querySelector('#yearsRunning').value = row.yearsRunning
  document.querySelector('#submit').value = 'Save Changes'
  document.querySelector('#entryForm').hidden = false
}

const remove = async function (event) {
  const response = await fetch('/api/delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: Number(event.target.dataset.id) })
  })

  render(await response.json())
}

const submit = async function (event) {
  // stop form submission from trying to load
  // a new .html page for displaying results...
  // this was the original browser behavior and still
  // remains to this day
  event.preventDefault()

  const form = document.querySelector('#entryForm'),
    theory = document.querySelector('#theory'),
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

  const data = await response.json()
  render(data)

  reset()
}

const reset = function () {
  editing = null

  document.querySelector('#entryForm').reset()
  document.querySelector('#submit').value = 'Add Conspiracy'
  document.querySelector('#entryForm').hidden = true
}

window.onload = function () {
  const form = document.querySelector('#entryForm'),
    newBtn = document.querySelector('#newBtn'),
    submitBtn = document.querySelector('#submit')

  newBtn.onclick = function () {
    const wasHidden = form.hidden

    reset()
    form.hidden = !wasHidden
  }

  submitBtn.onclick = submit

  load()
}
