import {Observable, Subject} from 'rx'
import Firebase from 'firebase'

// Observe an event by eventName on a firebase ref.
// No magic or .val unpacking is done, just listening
// and firing when being triggered.
function observe (ref, event) {
  return Observable.create(observer => {
    // Start listening to the event
    const unbind = ref.on(event,
      x => observer.onNext(x),
      err => observer.onError(err)
    )

    // Stop listening on dispose
    return () => {
      ref.off(event, unbind)
    }
  })
}

// Because firebase doesn't store this on /user or /uid or a custom event,
// we need a full blown new function that uses .onNext instead of .on 😒
function getAuth$ (ref) {
  return Observable.create(observer => {
    const cb = (auth) => {
      observer.onNext(auth ? auth.uid : null)
    }
    // Start listening
    ref.onAuth(cb)

    // Unlisten on dispose
    return () => {
      ref.offAuth(cb)
    }
  })
}

function dialoguer (request$, baseRef) {
  const refMap = {}

  const fromCallback = request => {
    return Observable.create(observer => {
      let ref = baseRef
      if (request.location) {
        ref = baseRef.child(request.location)
      }

      switch (request.method) {
        case 'unauth':
          ref[request.method]()
          break
        case 'set':
        case 'update':
          ref[request.method](
            request.data,
            error => {
              if (error) {
                observer.onError(error)
              } else {
                observer.onCompleted()
              }
            }
          )
          break
        case 'authWithCustomToken':
        case 'authWithPassword':
        case 'authWithOAuthPopup':
        case 'authWithOAuthRedirect':
          ref[request.method](
            request.data,
            (error, data) => {
              if (error) {
                observer.onError(error)
              } else {
                observer.onNext(data)
                observer.onCompleted()
              }
            }
          )

          break
        case 'authAnonymously':
        case 'remove':
          ref[request.method](
            (error, data) => {
              if (error) {
                observer.onError(error)
              } else {
                observer.onNext(data)
                observer.onCompleted()
              }
            }
          )

          break
        case 'authWithOAuthToken':
          ref[request.method](
            ...request.data,
            (error, data) => {
              if (error) {
                observer.onError(error)
              } else {
                observer.onNext(data)
                observer.onCompleted()
              }
            }
          )

          break
        default:
          throw new Error(`Unknown method: ${request.method}`)
      }

    })
  }

  return request$
    // .do(x => {
    //   console.log(`request$...`)
    //   console.log(x)
    // })
    .map(request => ({
      method: request.method,
      location: request.location,
      observable: fromCallback(request)
    }))
}

function makeEventsSelector(baseRef) {
  // Valid event names are `value`, `child_added`, `child_removed`, `child_changed`, `child_moved`
  return function events(eventName) {
    if (typeof eventName !== `string`) {
      throw new Error(`Firebase driver's events() expects argument to be a ` +
        `string representing the event type to listen for.`)
    }
    //console.log(`event selector namespace: ${this.path}`)
    //console.log(baseRef.toString())
    return observe(baseRef, eventName).share()
  }
}

function makePush (baseRef, response$) {
  return function push (selector) {
    const observer = new ReplaySubject(1)
    const childRef = baseRef.push(val, x => {
      if (x instanceof Error) {
        observer.onError(x)
      } else {
        observer.onNext(x)
        observer.onCompleted()
      }
    })

    const url = childRef.toString()
    const urlSplitter = url.split(`/`)
    const childNamespace = urlSplitter.slice(3)
    const path = namespace.join('/')

    return {
      context: makeContextObject(response$, path, this.auth$, childRef),
      observable: observer
    }
  }
}

function makeRefSelector(baseRef, response$) {
  return function select(selector) {
    if (typeof selector !== `string`) {
      throw new Error(`Firebase driver's select() expects the argument to be a ` +
        `string as a relative path`)
    }
    //console.log(`selector ${selector}`)
    let childNamespace
    const splitSelector = selector.trim().split(`/`).filter(x => x !== ``)
    if (splitSelector.length > 0 && splitSelector[0].length > 0) {
      childNamespace = this.path.split(`/`).filter(x => x !== ``).concat(splitSelector)
    } else {
      childNamespace = this.path.split(`/`).filter(x => x !== ``)
    }

    let path = childNamespace.join(`/`)
    let relPath = splitSelector.join(`/`)

    let childRef = baseRef
    if (relPath.length) {
      childRef = baseRef.child(relPath)
    }

    return makeContextObject(response$, path, this.auth$, childRef)
  }
}

function makeContextObject (response$, path, auth$, childRef, filterResponses) {
  return {
    path,
    auth$: auth$,
    select: makeRefSelector(childRef, response$),
    events: makeEventsSelector(childRef),
    response$,
    isolate: request$ => request$.do(request => request.location = path),
    isolated$: response$.filter(response => response.location === path),
    orderByChild: child => makeStateObject(
      response$,
      path,
      auth$,
      childRef.orderByChild(child)
    ),
    orderByKey: key => makeStateObject(
      response$,
      path,
      auth$,
      childRef.orderByKey(key)
    ),
    orderByValue: value => makeStateObject(
      response$,
      path,
      auth$,
      childRef.orderByValue(value)
    ),
    orderByPriority: priority => makeStateObject(
      response$,
      path,
      auth$,
      childRef.orderByPriority(priority)
    ),
    startAt: start => makeStateObject(
      response$,
      path,
      auth$,
      childRef.startAt(start)
    ),
    endAt: end => makeStateObject(
      response$,
      path,
      auth$,
      childRef.endAt(end)
    ),
    equalTo: val => makeStateObject(
      response$,
      path,
      auth$,
      childRef.equalTo(val)
    ),
    limitToFirst: qty => makeStateObject(
      response$,
      path,
      auth$,
      childRef.limitToFirst(qty)
    ),
    limitToLast: qty => makeStateObject(
      response$,
      path,
      auth$,
      childRef.limitToLast(qty)
    ),
    limit: qty => makeStateObject(
      response$,
      path,
      auth$,
      childRef.limit(qty)
    ),
    push: makePush(childRef)
  }
}

function makeFirebaseDriver (urlOrRef) {
  let rootRef = urlOrRef
  if (typeof urlOrRef === `string`) {
    rootRef = new Firebase(urlOrRef)
  } else if (!urlOrRef || typeof urlOrRef === 'object' && !urlOrRef.hasOwnProperty('child')) {
    throw new Error(`Firebase driver's select() expects the argument to be a ` +
      `string as a relative path or a Firebase reference`)
  }

  return function firebaseDriver (request$) {
    const response$ = dialoguer(request$, rootRef).share()

    return makeContextObject(response$, ``, getAuth$(rootRef), rootRef)
  }
}

export default makeFirebaseDriver
