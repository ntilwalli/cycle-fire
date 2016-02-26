#cycle-fire

An experimental CycleJS driver for [Firebase](https://www.firebase.com) which is modeled on [cyclejs/cycle-dom](https://github.com/cyclejs/dom) in terms of `select` and `events` semantics as well as offering a form of isolation for interacting with Firebase from the perspective of a specific child reference.
This driver was partly inspired by the one implemented by @dralletje at [dralletje/cycle-firebase](https://github.com/dralletje/cycle-firebase), although it uses a significantly different approach.

# Usage Example

```
import Cycle from '@cycle/core'
import {makeFirebaseDriver} from 'cycle-firebase'

let main = ({firebase}) => {
  // ... Code that uses firebase driver
}

Cycle.run(main, {
  firebase: makeFirebaseDriver(YOUR_FIREBASE_URL_OR_FIREBASE_REF),
  // ... Other drivers
})

```

# API
## Interfaces
```
// See below for explanations
interface FirebaseContext {
  response$: Observable,
  auth$: Observable,
  select: Function,
  events: Function,
  isolate: Function,
  isolated$: Observable,
  ...more
}

interface FirebaseRequest {
  method: string, //  name of any async Firebase method other not including on/off/onAuth/offAuth
  location: string, // path to location where method should be applied
  data: any? | any[] // arguments which should be applied to method, when multiple should be sent as array in proper order
}

interface FirebaseResponse {
  method: string, //  name of any async Firebase method other not including on/off/onAuth/offAuth
  location: string, // path to location where method should be applied
  observable: Observable<any> // Upon subscribing to this observable, the method is actually invoked and observable calls onNext->onComplete or onError
}
```

## Source
The source returns a `FirebaseContext` with multiple attributes, the main ones being:
* `response$`
* `auth$`
* `select(...)`
* `events(...)`
* `push(...)`
* `isolate(...)`
* `isolated$`

#### `.response$: Observable<FirebaseResponse>`
An observable stream which wraps all "response"s from Firebase.  They are not actual responses, but objects which contain an observable which wraps the async call to a Firebase method.  Upon subscribing to the internal observable, the method is invoked and responses can be managed appropriately.

#### `.auth$: Observable<null|string>`
An observable stream which signals a user moving between authorized states.  When logged in a string representing the user's Firebase `uid` is emitted, when not not logged in, `null`

#### `.select(selector: string): FirebaseContext`
Function which takes a Firebase path and returns a new `FirebaseContext` which uses the relative path sent selector for the base Firebase ref

#### `.events(eventName: string): Observable<any>`
Function which takes any of `value`, `child_added`, `child_removed`, `child_changed`, `child_moved` and returns an Observable representing changes for the current FirebaseContext

#### `.push(value: any): { context: FirebaseContext, observable: Observable<any>}`
Function which takes a value to the current FirebaseContext.  Returns an object containing the context associated with the pushed value and an observable representing the success/failure of the operation.

#### `.isolate(request$: Observable<FirebaseRequest>): Observable<FirebaseRequest>`
Function which takes an observable of FirebaseRequests and modifies the location property to be the path associated with the current context

#### `.isolated$: Observable<FirebaseResponse>`
Similar to `response$` from above, except all responses that aren't from the path associated with the current context are filtered out

## Sink
The sink takes an Observable<FirebaseRequest>.  The `isolate` function described above can help append the location to a given request.
