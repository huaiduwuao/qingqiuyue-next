import { contentClient } from '@/lib/api/client';
import {ArticleItem} from "@/beans/content";

export async function process(params: any) {
  return contentClient("client-content/todo-queue/process", {
    method: "POST",
    data: params
  });
}

export async function page(params: any) {
  return contentClient("client-content/todo-queue/page", {
    params
  });
}

export async function remove(ids: number[]) {
  return contentClient("client-content/todo-queue/removeByIds", {
    method: "DELETE",
    data: ids
  });
}

export async function save(params: ArticleItem) {
  return contentClient("client-content/todo-queue/save", {
    method: "POST",
    data: params
  });
}

export async function update(params: ArticleItem) {
  return contentClient("client-content/todo-queue/update", {
    method: "POST",
    data: params
  });
}

export async function detail(params: ArticleItem) {
  return contentClient("client-content/todo-queue/detail", {
    params
  });
}
