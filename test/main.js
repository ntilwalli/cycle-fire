import test from 'tape-catch'
import {Observable, Subject} from 'rx'
import makeFirebaseDriver from '../index'

test("Basic functionality", t => {
  t.plan(4)
  t.equals(typeof makeFirebaseDriver, 'function', "should be a function")
  t.throws(() => makeFirebaseDriver(), `should throw when missing url or Firebase reference`)
  const url = `https://blazing-inferno-802.firebaseio.com/`
  //const rootRef = new Firebase(url)
  //rootRef.on('value', (snapshot) => console.log(snapshot.val()), (err) => console.log(err))
  const driver = makeFirebaseDriver(url)
  const input$ = Observable.just({
    method: `set`,
    location: `events/e424/core/name`,
    data: `Rando event name`
  })
  const FBase = driver(input$)

  const response$ = FBase.response$
    .do(x => {console.log(`FBase.response$...`); console.log(x)})
    .filter(x => x.method === `set`)
    .flatMap(x => x.response$)
    .subscribe(x => {
      t.pass(`Schema updated with set method`)
    })

  const root = FBase.select(`/`).select(`events/e424/core/name`)
  //console.log(root)
  const rootValue = root.events('value').subscribe(
    x => {
      //console.log(x.val())
      t.equals(x.val(), `Rando event name`, `Has expected event name`)
    }
  )

  //t.end()

  // let rootEl = document.createElement("div")
  // rootEl.setAttribute("id", "testId")
  // let bodyEl = document.body.appendChild(rootEl)
  //
  //
  // let testVMaps = [
  //   new VNode('map', {anchorId: "testId", centerZoom: {center: [4, 5], zoom: 5}}),
  //   new VNode('map', {anchorId: "testId", centerZoom: {center: [4, 5], zoom: 5}}, [
  //     new VNode('tileLayer', {tile: "testTile", attributes: {id: "testTile1"}})
  //   ])
  // ]
  //
  // let map$ = Rx.Observable.interval(100).take(2).map(x => testVMaps[x])
  //
  // let outFunc = makeMapDOMDriver("pk.eyJ1IjoibXJyZWRlYXJzIiwiYSI6IjQtVVRTZkEifQ.ef_cKBTmj8rSr7VypppZdg")
  // t.equals(typeof outFunc, 'function', "should output a function")
  // let outVal = outFunc(map$)
  // t.ok(outVal.select && outVal.dispose, "should output object with valid select and dispose properties")
  //
  //
  //
  // setTimeout(() => {
  //   t.ok(rootEl.mapDOM, "should have valid mapDOM property on given element")
  //   t.end()
  // }, 300)

})
