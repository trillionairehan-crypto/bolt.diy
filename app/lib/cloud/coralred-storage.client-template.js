const CLOUD_API_BASE = import.meta.env.VITE_CLOUD_API_BASE || '';
const CLOUD_APP_TOKEN = import.meta.env.VITE_CLOUD_APP_TOKEN || '';
const CLOUD_ENABLED = Boolean(CLOUD_API_BASE && CLOUD_APP_TOKEN);

export const isCloudStorageEnabled = CLOUD_ENABLED;

const DEVICE_KEY_STORAGE_KEY = 'coralred_cloud_device_key';
let memoryDeviceKey = null;

function getDeviceKey() {
  try {
    let key = localStorage.getItem(DEVICE_KEY_STORAGE_KEY);

    if (!key) {
      key = crypto.randomUUID();
      localStorage.setItem(DEVICE_KEY_STORAGE_KEY, key);
    }

    return key;
  } catch {
    if (!memoryDeviceKey) {
      memoryDeviceKey = crypto.randomUUID();
    }

    return memoryDeviceKey;
  }
}

const memoryStore = new Map();

function memoryCollection(collection) {
  if (!memoryStore.has(collection)) {
    memoryStore.set(collection, new Map());
  }

  return memoryStore.get(collection);
}

function nowIso() {
  return new Date().toISOString();
}

export class CoralredStorageError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'CoralredStorageError';
    this.status = status;
  }
}

function mapErrorMessage(status) {
  if (status === 401 || status === 403) {
    return '저장 기능 연결에 문제가 있어요. 다시 배포해보세요.';
  }

  if (status === 404) {
    return '찾을 수 없어요.';
  }

  if (status === 413) {
    return '저장할 내용이 너무 커요.';
  }

  if (status === 429) {
    return '요청이 너무 많아요. 잠시 후 다시 시도해주세요.';
  }

  if (status === 507) {
    return '저장 공간이 다 찼어요. 요금제를 확인해주세요.';
  }

  return '저장하다가 문제가 생겼어요. 잠시 후 다시 시도해주세요.';
}

async function request(method, pathSuffix, body) {
  const url = `${CLOUD_API_BASE}/${pathSuffix}`;

  let response;

  try {
    response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${CLOUD_APP_TOKEN}`,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new CoralredStorageError('네트워크 문제로 저장하지 못했어요. 잠시 후 다시 시도해주세요.', 0);
  }

  if (!response.ok) {
    let message = mapErrorMessage(response.status);

    try {
      const errorBody = await response.json();

      if (errorBody && typeof errorBody.error === 'string') {
        message = errorBody.error;
      }
    } catch {
      // 응답 본문이 JSON이 아닐 수 있음 — 상태코드 기반 기본 메시지를 그대로 씀.
    }

    throw new CoralredStorageError(message, response.status);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

/**
 * db.create/list/get/update/remove — 생성된 앱이 저장을 위해 쓰는 유일한 인터페이스.
 * CLOUD_ENABLED가 false(로컬 미리보기 또는 배포 전)면 인메모리 Map으로 완전히 흉내내서
 * 배포 전에도 화면이 정상적으로 동작함 — 새로고침하면 사라짐.
 */
export const db = {
  async create(collection, data) {
    const deviceKey = getDeviceKey();

    if (!CLOUD_ENABLED) {
      const id = crypto.randomUUID();
      const doc = { id, data, createdAt: nowIso(), updatedAt: nowIso() };
      memoryCollection(collection).set(id, doc);

      return doc;
    }

    return request('POST', collection, { deviceKey, data });
  },

  async list(collection, options) {
    const deviceKey = getDeviceKey();
    const limit = (options && options.limit) || 20;

    if (!CLOUD_ENABLED) {
      const all = Array.from(memoryCollection(collection).values()).sort((a, b) =>
        a.createdAt < b.createdAt ? 1 : -1,
      );

      return { items: all.slice(0, limit), nextCursor: null };
    }

    const params = new URLSearchParams({ deviceKey, limit: String(limit) });

    if (options && options.cursor) {
      params.set('cursor', options.cursor);
    }

    return request('GET', `${collection}?${params.toString()}`);
  },

  async get(collection, id) {
    const deviceKey = getDeviceKey();

    if (!CLOUD_ENABLED) {
      const doc = memoryCollection(collection).get(id);

      if (!doc) {
        throw new CoralredStorageError('찾을 수 없어요.', 404);
      }

      return doc;
    }

    return request('GET', `${collection}/${encodeURIComponent(id)}?deviceKey=${encodeURIComponent(deviceKey)}`);
  },

  async update(collection, id, data) {
    const deviceKey = getDeviceKey();

    if (!CLOUD_ENABLED) {
      const coll = memoryCollection(collection);
      const existing = coll.get(id);

      if (!existing) {
        throw new CoralredStorageError('찾을 수 없어요.', 404);
      }

      const updated = { ...existing, data, updatedAt: nowIso() };
      coll.set(id, updated);

      return updated;
    }

    return request('PATCH', `${collection}/${encodeURIComponent(id)}`, { deviceKey, data });
  },

  async remove(collection, id) {
    const deviceKey = getDeviceKey();

    if (!CLOUD_ENABLED) {
      memoryCollection(collection).delete(id);
      return null;
    }

    return request('DELETE', `${collection}/${encodeURIComponent(id)}?deviceKey=${encodeURIComponent(deviceKey)}`);
  },
};
