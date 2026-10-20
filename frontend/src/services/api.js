/**
 * API Service - communicates with Python FastAPI backend.
 * Base URL is proxied through Vite dev server (/api -> localhost:8000/api)
 */

const isBrowser = typeof window !== 'undefined';
const isFileProtocol = isBrowser && window.location && window.location.protocol === 'file:';
const desktopRuntime = isBrowser ? window.desktopRuntime : null;

const API_BASE =
  desktopRuntime?.backendBaseUrl ||
  (isFileProtocol ? 'http://127.0.0.1:8000/api' : '/api');

class ApiService {
  constructor() {
    this.backendAvailable = null;
    this.capabilities = {};
  }

  isElectronRuntime() {
    return Boolean(desktopRuntime?.isElectron);
  }

  async getDesktopStorageInfo() {
    if (!desktopRuntime?.getStorageInfo) return null;
    return desktopRuntime.getStorageInfo();
  }

  async openDesktopStorageDirectory() {
    if (!desktopRuntime?.openStorageDirectory) {
      return { ok: false, error: 'Desktop storage access is only available in Electron.' };
    }
    return desktopRuntime.openStorageDirectory();
  }

  toTransformerPayload(transformer = {}) {
    return {
      id: transformer.id || '',
      name: transformer.name || '',
      mnemonic: transformer.mnemonic || '',
      serialNumber: transformer.serialNumber || '',
      brand: transformer.brand || '',
      maker: transformer.maker || '',
      voltage: transformer.voltage || '',
      loadMVA: Number(transformer.loadMVA) || 0,
      site: transformer.site || '',
      dateEnergized: transformer.dateEnergized || '',
      dateManufactured: transformer.dateManufactured || '',
      oilBrand: transformer.oilBrand || '',
      oilType: transformer.oilType || '',
      paperType: transformer.paperType || 'Not specified',
    };
  }

  toOilBrandPayload(oilBrand = {}) {
    return {
      id: oilBrand.id || '',
      name: oilBrand.name || '',
      oilType: oilBrand.oilType || '',
      notes: oilBrand.notes || '',
    };
  }

  toResultPayload(result = {}) {
    return {
      id: result.id || undefined,
      transformerId: result.transformerId || '',
      date: result.date || '',
      H2: Number(result.H2) || 0,
      CH4: Number(result.CH4) || 0,
      C2H2: Number(result.C2H2) || 0,
      C2H4: Number(result.C2H4) || 0,
      C2H6: Number(result.C2H6) || 0,
      CO: Number(result.CO) || 0,
      CO2: Number(result.CO2) || 0,
      O2: Number(result.O2) || 0,
      N2: Number(result.N2) || 0,
      moisture: Number(result.moisture) || 0,
      bdv: Number(result.bdv) || 0,
      acidity: Number(result.acidity) || 0,
      ift: Number(result.ift) || 0,
      color: result.color || '',
      powerFactor: Number(result.powerFactor) || 0,
      testType: result.testType || 'Routine',
      flashPoint: Number(result.flashPoint) || 0,
      flashPointOpenCup: Number(result.flashPointOpenCup) || 0,
      firePointOpenCup: Number(result.firePointOpenCup) || 0,
      inhibitor: Number(result.inhibitor) || 0,
      passivator: Number(result.passivator) || 0,
      copperCorrosive: result.copperCorrosive || '',
      density: Number(result.density) || 0,
      dbds: Number(result.dbds) || 0,
      viscosity40: Number(result.viscosity40) || 0,
      methanol: Number(result.methanol) || 0,
      pcb: Number(result.pcb) || 0,
      resistivity: Number(result.resistivity) || 0,
      specificGravity: Number(result.specificGravity) || 0,
      fol2: Number(result.fol2) || 0,
      hmf5: Number(result.hmf5) || 0,
      fal2: Number(result.fal2) || 0,
      acf2: Number(result.acf2) || 0,
      mef5: Number(result.mef5) || 0,
      copperCu: Number(result.copperCu) || 0,
      ironFe: Number(result.ironFe) || 0,
      aluminumAl: Number(result.aluminumAl) || 0,
      dpFromFuran: Number(result.dpFromFuran) || 0,
      dpFromMethanol: Number(result.dpFromMethanol) || 0,
      notes: result.notes || '',
    };
  }

  toHistoryPayload(history = []) {
    return history.map((r) => ({
      id: r.id || '',
      date: r.date,
      H2: Number(r.H2) || 0,
      CH4: Number(r.CH4) || 0,
      C2H2: Number(r.C2H2) || 0,
      C2H4: Number(r.C2H4) || 0,
      C2H6: Number(r.C2H6) || 0,
      CO: Number(r.CO) || 0,
      CO2: Number(r.CO2) || 0,
      O2: Number(r.O2) || 0,
      N2: Number(r.N2) || 0,
      moisture: Number(r.moisture) || 0,
      bdv: Number(r.bdv) || 0,
      acidity: Number(r.acidity) || 0,
      ift: Number(r.ift) || 0,
      powerFactor: Number(r.powerFactor) || 0,
      flashPoint: Number(r.flashPoint) || 0,
      flashPointOpenCup: Number(r.flashPointOpenCup) || 0,
      firePointOpenCup: Number(r.firePointOpenCup) || 0,
      inhibitor: Number(r.inhibitor) || 0,
      passivator: Number(r.passivator) || 0,
      density: Number(r.density) || 0,
      dbds: Number(r.dbds) || 0,
      viscosity40: Number(r.viscosity40) || 0,
      methanol: Number(r.methanol) || 0,
      pcb: Number(r.pcb) || 0,
      resistivity: Number(r.resistivity) || 0,
      specificGravity: Number(r.specificGravity) || 0,
      fol2: Number(r.fol2) || 0,
      hmf5: Number(r.hmf5) || 0,
      fal2: Number(r.fal2) || 0,
      acf2: Number(r.acf2) || 0,
      mef5: Number(r.mef5) || 0,
      copperCu: Number(r.copperCu) || 0,
      ironFe: Number(r.ironFe) || 0,
      aluminumAl: Number(r.aluminumAl) || 0,
      dpFromFuran: Number(r.dpFromFuran) || 0,
      dpFromMethanol: Number(r.dpFromMethanol) || 0,
    }));
  }

  async request(endpoint, options = {}) {
    const url = `${API_BASE}${endpoint}`;
    const config = {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    };
    const res = await fetch(url, config);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || `API error ${res.status}`);
    }
    return res.json();
  }

  async checkHealth() {
    try {
      const data = await this.request('/health');
      this.backendAvailable = true;
      this.capabilities = data.capabilities || {};
      return data;
    } catch {
      this.backendAvailable = false;
      this.capabilities = {};
      return null;
    }
  }

  async getStorage() {
    return this.request('/storage');
  }

  async bootstrapStorage(transformers = [], results = []) {
    return this.request('/storage/bootstrap', {
      method: 'POST',
      body: JSON.stringify({
        transformers: transformers.map((t) => this.toTransformerPayload(t)),
        results: results.map((r) => this.toResultPayload(r)),
      }),
    });
  }

  async createTransformer(transformer) {
    return this.request('/transformers', {
      method: 'POST',
      body: JSON.stringify(this.toTransformerPayload(transformer)),
    });
  }

  async updateTransformer(id, transformer) {
    return this.request(`/transformers/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(this.toTransformerPayload(transformer)),
    });
  }

  async deleteTransformer(id) {
    return this.request(`/transformers/${encodeURIComponent(id)}`, { method: 'DELETE' });
  }

  async getOilBrands() {
    return this.request('/oil-brands');
  }

  async createOilBrand(oilBrand) {
    return this.request('/oil-brands', {
      method: 'POST',
      body: JSON.stringify(this.toOilBrandPayload(oilBrand)),
    });
  }

  async updateOilBrand(id, oilBrand) {
    return this.request(`/oil-brands/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(this.toOilBrandPayload({ ...oilBrand, id })),
    });
  }

  async deleteOilBrand(id) {
    return this.request(`/oil-brands/${encodeURIComponent(id)}`, { method: 'DELETE' });
  }

  async createResult(result) {
    return this.request('/results', {
      method: 'POST',
      body: JSON.stringify(this.toResultPayload(result)),
    });
  }

  async updateResult(id, result) {
    return this.request(`/results/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(this.toResultPayload({ ...result, id })),
    });
  }

  async deleteResult(id) {
    return this.request(`/results/${encodeURIComponent(id)}`, { method: 'DELETE' });
  }

  async predictArima(transformer, history, forecastMonths = 12, gases = null) {
    return this.request('/predict/arima', {
      method: 'POST',
      body: JSON.stringify({
        transformer: this.toTransformerPayload(transformer),
        history: this.toHistoryPayload(history),
        forecast_months: forecastMonths,
        gases: gases || ['H2', 'CH4', 'C2H2', 'C2H4', 'C2H6', 'CO', 'CO2'],
      }),
    });
  }

  async predictLstm(transformer, history, forecastMonths = 12, gases = null) {
    return this.request('/predict/lstm', {
      method: 'POST',
      body: JSON.stringify({
        transformer: this.toTransformerPayload(transformer),
        history: this.toHistoryPayload(history),
        forecast_months: forecastMonths,
        gases: gases || ['H2', 'CH4', 'C2H2', 'C2H4', 'C2H6', 'CO', 'CO2'],
      }),
    });
  }

  async predictXgboost(transformer, history, forecastMonths = 12, gases = null) {
    return this.request('/predict/xgboost', {
      method: 'POST',
      body: JSON.stringify({
        transformer: this.toTransformerPayload(transformer),
        history: this.toHistoryPayload(history),
        forecast_months: forecastMonths,
        gases: gases || ['H2', 'CH4', 'C2H2', 'C2H4', 'C2H6', 'CO', 'CO2'],
      }),
    });
  }

  async predictLightgbm(transformer, history, forecastMonths = 12, gases = null) {
    return this.request('/predict/lightgbm', {
      method: 'POST',
      body: JSON.stringify({
        transformer: this.toTransformerPayload(transformer),
        history: this.toHistoryPayload(history),
        forecast_months: forecastMonths,
        gases: gases || ['H2', 'CH4', 'C2H2', 'C2H4', 'C2H6', 'CO', 'CO2'],
      }),
    });
  }

  async predictNatureHybrid(transformer, history, forecastMonths = 12, gases = null) {
    return this.request('/predict/nature-hybrid', {
      method: 'POST',
      body: JSON.stringify({
        transformer: this.toTransformerPayload(transformer),
        history: this.toHistoryPayload(history),
        forecast_months: forecastMonths,
        gases: gases || ['H2', 'CH4', 'C2H2', 'C2H4', 'C2H6', 'CO', 'CO2'],
      }),
    });
  }

  async predictFaultRf(transformer, history, forecastMonths = 12) {
    return this.request('/predict/fault-rf', {
      method: 'POST',
      body: JSON.stringify({
        transformer: this.toTransformerPayload(transformer),
        history: this.toHistoryPayload(history),
        forecast_months: forecastMonths,
        gases: ['H2', 'CH4', 'C2H2', 'C2H4', 'C2H6', 'CO', 'CO2'],
      }),
    });
  }

  async cluster(transformers, latestResults, nClusters = 3) {
    return this.request('/cluster', {
      method: 'POST',
      body: JSON.stringify({
        transformers: transformers.map((t) => ({
          id: t.id,
          brand: t.brand || '',
          maker: t.maker || '',
          voltage: t.voltage || '',
          loadMVA: Number(t.loadMVA) || 0,
          site: t.site || '',
          dateEnergized: t.dateEnergized || '',
          dateManufactured: t.dateManufactured || '',
          oilBrand: t.oilBrand || '',
          oilType: t.oilType || '',
          paperType: t.paperType || 'Not specified',
        })),
        latest_results: latestResults,
        n_clusters: nClusters,
      }),
    });
  }

  async detectAnomalies(transformer, history, contamination = 0.1, mode = 'dga') {
    return this.request('/anomaly', {
      method: 'POST',
      body: JSON.stringify({
        transformer: this.toTransformerPayload(transformer),
        history: this.toHistoryPayload(history),
        contamination,
        mode,
      }),
    });
  }

  async getAiSummary(transformerId, resultId = '') {
    const query = [`transformer_id=${encodeURIComponent(transformerId)}`];
    if (resultId) query.push(`result_id=${encodeURIComponent(resultId)}`);
    return this.request(`/ai/summary?${query.join('&')}`);
  }

  async getAiFeatures(transformerId, resultId = '') {
    const query = [`transformer_id=${encodeURIComponent(transformerId)}`];
    if (resultId) query.push(`result_id=${encodeURIComponent(resultId)}`);
    return this.request(`/ai/features?${query.join('&')}`);
  }

  async getAiSimilarCases(transformerId, limit = 5, resultId = '') {
    const query = [
      `transformer_id=${encodeURIComponent(transformerId)}`,
      `limit=${encodeURIComponent(limit)}`,
    ];
    if (resultId) query.push(`result_id=${encodeURIComponent(resultId)}`);
    return this.request(`/ai/similar-cases?${query.join('&')}`);
  }

  async getAiPrediction(transformerId, resultId = '') {
    const query = [`transformer_id=${encodeURIComponent(transformerId)}`];
    if (resultId) query.push(`result_id=${encodeURIComponent(resultId)}`);
    return this.request(`/ai/predict?${query.join('&')}`);
  }

  async generateAiAssessment(transformerId, resultId = '') {
    const query = [`transformer_id=${encodeURIComponent(transformerId)}`];
    if (resultId) query.push(`result_id=${encodeURIComponent(resultId)}`);
    return this.request(`/ai/generate-assessment?${query.join('&')}`);
  }

  async getAiModelInsights(transformerId, resultId = '') {
    const query = [`transformer_id=${encodeURIComponent(transformerId)}`];
    if (resultId) query.push(`result_id=${encodeURIComponent(resultId)}`);
    return this.request(`/ai/model-insights?${query.join('&')}`);
  }

  async getAiAssessmentHistory(transformerId = '', limit = 100) {
    const query = [`limit=${encodeURIComponent(limit)}`];
    if (transformerId) query.push(`transformer_id=${encodeURIComponent(transformerId)}`);
    return this.request(`/ai/assessment-history?${query.join('&')}`);
  }

  async createAiAssessmentHistory(payload) {
    return this.request('/ai/assessment-history', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async importAiAssessmentHistory(payload) {
    return this.request('/ai/assessment-history/import', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async updateAiAssessmentHistory(id, payload) {
    return this.request(`/ai/assessment-history/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  }

  // ---- Auth ----

  async signIn(email, password) {
    return this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  async signUp(name, email, password) {
    return this.request('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    });
  }

  async listUsers(requesterId) {
    return this.request(`/auth/users?requester_id=${encodeURIComponent(requesterId || '')}`);
  }

  async createUserByAdmin(requesterId, payload) {
    return this.request('/auth/users', {
      method: 'POST',
      body: JSON.stringify({ requester_id: requesterId, ...payload }),
    });
  }

  async updateUserByAdmin(requesterId, userId, payload) {
    return this.request(`/auth/users/${encodeURIComponent(userId)}`, {
      method: 'PUT',
      body: JSON.stringify({ requester_id: requesterId, ...payload }),
    });
  }

  async approveUserByAdmin(requesterId, userId) {
    return this.request(`/auth/users/${encodeURIComponent(userId)}/approve`, {
      method: 'POST',
      body: JSON.stringify({ requester_id: requesterId }),
    });
  }

  async deleteUserByAdmin(requesterId, userId) {
    return this.request(`/auth/users/${encodeURIComponent(userId)}`, {
      method: 'DELETE',
      body: JSON.stringify({ requester_id: requesterId }),
    });
  }
}

const api = new ApiService();
export default api;
