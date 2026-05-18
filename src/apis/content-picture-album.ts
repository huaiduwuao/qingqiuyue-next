import { contentClient } from '@/lib/api/client';
import {PictureAlbumItem} from "@/beans/content";


export async function process(params: any) {
  return contentClient("client-content/picture-album/process", {
    method: "POST",
    data: params
  });
}

export async function page(params: any) {
  return contentClient("client-content/picture-album/page", {
    params
  });
}

export async function detail(params: any) {
  return contentClient("client-content/picture-album/detail", {
    params
  });
}


export async function suggest(params: PictureAlbumItem) {
  return contentClient("client-content/picture-album/suggest", {
    params
  });
}

export async function remove(ids: number[]) {
  return contentClient("client-content/picture-album/removeByIds", {
    method: "DELETE",
    data: ids
  });
}

export async function save(params: PictureAlbumItem) {
  return contentClient("client-content/picture-album/save", {
    method: "POST",
    data: params
  });
}

export async function update(params: PictureAlbumItem) {
  return contentClient("client-content/picture-album/update", {
    method: "POST",
    data: params
  });
}
