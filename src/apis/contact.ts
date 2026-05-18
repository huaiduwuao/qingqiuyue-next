import { adminClient } from '@/lib/api/client';


export async function recentContactList(params: any) {
  return adminClient("/userContactRecent/client/list", {
    params
  });
}

export async function newContact(params: any) {

  return adminClient("/userContactRecent/client/insert", {
    method: "POST",
    data: params
  });
}

export async function recentExtProcess(params: any) {
  return adminClient("/userContactRecentExt/client/process", {
    method: "POST",
    data: params
  });
}

export async function groupList(params: any) {
  return adminClient("/userContactGroup/client/list", {
    params
  });
}

export async function groupSuggest(params: any) {
  return adminClient("/userContactGroup/client/suggest", {
    params
  });
}

export async function newGroup(params: any) {
  return adminClient("/userContactGroup/create", {
    method: "POST",
    data: params
  });
}

export async function sendGroup(params: any) {
  return adminClient("/userContactGroup/send", {
    method: "POST",
    data: params
  });
}

export async function agreeGroup(params: any) {
  return adminClient("/userContactGroup/agree", {
    method: "POST",
    data: params
  });
}

export async function inviteGroup(params: any) {
  return adminClient("/userContactGroup/invite", {
    method: "POST",
    data: params
  });
}

export async function list(params: any) {
  return adminClient("/userContact/client/list", {
    params
  });
}

export async function remove(ids: number[]) {
  return adminClient("/userContact/removeByIds", {
    method: "DELETE",
    data: ids
  });
}

export async function agree(params: any) {
  return adminClient("/userContact/agree", {
    method: "POST",
    data: params
  });
}

export async function send(params: any) {
  return adminClient("/userContact/send", {
    method: "POST",
    data: params
  });
}



export async function historyChat(params: any) {
  return adminClient("/notice/client/historyChat", {
    method: "POST",
    data: params
  });
}

export async function pullStream(params: any) {
  return adminClient("/notice/pullStream", {
    method: "POST",
    data: params
  });
}
