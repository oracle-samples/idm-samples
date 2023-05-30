/* tslint:disable:no-console */
import { KMSIConfiguration } from "../types/uiTypes";

const KMSI_STORE_KEY = "iam_kmsi_info"

function getExistingKmsi():KMSIConfiguration[] {
  const localStore = window.localStorage;
  // If no local storage, use cookies?
  // Figure this out later
  const kmsiInfoString = localStore.getItem(KMSI_STORE_KEY);
  if (!kmsiInfoString) {
    // No stored user info, so just proceed to login
    return [];
  }
  try {
    let kmsiInfo = JSON.parse(kmsiInfoString) as KMSIConfiguration[];
    // Validate the stucture, since it is user controlled
    if (Array.isArray(kmsiInfo)) {
      kmsiInfo = kmsiInfo.filter((value) => {
        return value.displayName && typeof value.displayName === 'string' && value.ref !== undefined && typeof value.ref === 'number';
      });
      return kmsiInfo;
    }
    console.warn("KMSI data in local storage looked to be corrupted. Ignoring.")
    localStore.removeItem(KMSI_STORE_KEY);
    return [];
  } catch (err) {
    console.log(err);
    console.warn("KMSI data in local storage looked to be corrupted. Ignoring.")
    localStore.removeItem(KMSI_STORE_KEY);
    return [];
  }
}

// Determine which index to for a given username
function getNextKmsiRef(userName:string):number {
  const localStore = window.localStorage;
  // If no local storage, use cookies?
  // Figure this out later
  const kmsiInfoString = localStore.getItem(KMSI_STORE_KEY);
  if (!kmsiInfoString) {
    // No stored user info, so we can start at 0.
    return 0
  }
  // Otherwise, take advantage of the sparse implemetation of Arrays.
  try {
    const usedRefs: boolean[] = [];
    let kmsiInfo = JSON.parse(kmsiInfoString) as KMSIConfiguration[];
    if (Array.isArray(kmsiInfo)) {
      kmsiInfo = kmsiInfo.filter((value) => {
        return value.displayName && typeof value.displayName === 'string' && value.ref !== undefined && typeof value.ref === 'number';
      });
      for(const kmsiEntry of kmsiInfo){
        if(kmsiEntry.displayName === userName){
          return kmsiEntry.ref;
        }
        usedRefs[kmsiEntry.ref] = true;
      }
      let newRef = 0;
      while(true){
        if(usedRefs[newRef] === undefined){
          return newRef;
        }
        newRef++;
      }
    }
    console.warn("KMSI data in local storage looked to be corrupted. Deleting it.")
    localStore.removeItem(KMSI_STORE_KEY);
    return 0;
  }catch (err) {
    console.error(err);
    console.warn("KMSI data in local storage looked to be corrupted. Deleting it.")
    localStore.removeItem(KMSI_STORE_KEY);
    return 0;
  }
}

function storeKmsiSetting(userKmsi:KMSIConfiguration):void{
  const localStore = window.localStorage;
  // If no local storage, use cookies?
  // Figure this out later
  const kmsiInfoString = localStore.getItem(KMSI_STORE_KEY);
  if (!kmsiInfoString) {
    // No stored user info, so we need to create one
    return localStore.setItem(KMSI_STORE_KEY, JSON.stringify([userKmsi]));
  }
  // Otherwise we need to merge them
  try {
    let kmsiInfo = JSON.parse(kmsiInfoString) as KMSIConfiguration[];
    // Validate the stucture, since it is user controlled
    if (Array.isArray(kmsiInfo)) {
      kmsiInfo = kmsiInfo.filter((value) => {
        return value.displayName && typeof value.displayName === 'string' && value.ref !== undefined && typeof value.ref === 'number';
      });
      // Merge this one in
      let newValue = true;
      for(const kmsiEntry of kmsiInfo){
        if(kmsiEntry.displayName === userKmsi.displayName){
          newValue = false;
          kmsiEntry.ref = userKmsi.ref;
          break;
        }
      }
      if(newValue){
        kmsiInfo.push(userKmsi);
      }
      // Write back
      return localStore.setItem(KMSI_STORE_KEY, JSON.stringify(kmsiInfo));
    }
    // If it was an invalid structure, we can override it
    return localStore.setItem(KMSI_STORE_KEY, JSON.stringify([userKmsi]));
  } catch (err) {
    console.error(err);
    console.warn("KMSI data in local storage looked to be corrupted. Overriding it.")
    return localStore.setItem(KMSI_STORE_KEY, JSON.stringify([userKmsi]));
  }
}

function clearKmsiEntry(userKmsi:KMSIConfiguration):void{
  if(!userKmsi || !userKmsi.displayName){
    return;
  }
  const localStore = window.localStorage;
  // If no local storage, use cookies?
  // Figure this out later
  const kmsiInfoString = localStore.getItem(KMSI_STORE_KEY);
  if (!kmsiInfoString) {
    // No stored user info, so nothing to clear?
    return;
  }
  try {
    let kmsiInfo = JSON.parse(kmsiInfoString) as KMSIConfiguration[];
    // Validate the stucture, since it is user controlled
    if (Array.isArray(kmsiInfo)) {
      kmsiInfo = kmsiInfo.filter((value) => {
        return value.displayName && value.displayName !== userKmsi.displayName;
      });
      return localStore.setItem(KMSI_STORE_KEY, JSON.stringify(kmsiInfo));
    }
    console.warn("KMSI data in local storage looked to be corrupted, clearing it.")
    localStore.removeItem(KMSI_STORE_KEY);
    return;
  } catch (err) {
    console.error(err);
    console.warn("KMSI data in local storage looked to be corrupted, clearing it.")
    localStore.removeItem(KMSI_STORE_KEY);
    return;
  }

}

export { getExistingKmsi, storeKmsiSetting, clearKmsiEntry, getNextKmsiRef };