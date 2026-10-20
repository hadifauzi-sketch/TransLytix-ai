"""
Pure-numpy LSTM implementation for time-series forecasting.

Used as a fallback when TensorFlow is unavailable (e.g. PyInstaller builds).
Matches the architecture used in main.py: LSTM(32) → Dropout → LSTM(16) → Dropout → Dense(1).
"""

import numpy as np


def _sigmoid(x):
    return 1.0 / (1.0 + np.exp(-np.clip(x, -15, 15)))


def _tanh(x):
    return np.tanh(x)


class _LSTMCell:
    """Single LSTM cell with Xavier initialization."""

    def __init__(self, input_size, hidden_size, rng):
        scale = np.sqrt(2.0 / (input_size + hidden_size))
        self.Wf = rng.normal(0, scale, (input_size + hidden_size, hidden_size)).astype(np.float32)
        self.bf = np.zeros(hidden_size, dtype=np.float32)
        self.Wi = rng.normal(0, scale, (input_size + hidden_size, hidden_size)).astype(np.float32)
        self.bi = np.zeros(hidden_size, dtype=np.float32)
        self.Wc = rng.normal(0, scale, (input_size + hidden_size, hidden_size)).astype(np.float32)
        self.bc = np.zeros(hidden_size, dtype=np.float32)
        self.Wo = rng.normal(0, scale, (input_size + hidden_size, hidden_size)).astype(np.float32)
        self.bo = np.zeros(hidden_size, dtype=np.float32)
        self.hidden_size = hidden_size

    def forward_sequence(self, X, return_sequences=False, dropout_rate=0.0, training=False, rng=None):
        """X shape: (batch, timesteps, features). Returns hidden states."""
        batch, timesteps, _ = X.shape
        h = np.zeros((batch, self.hidden_size), dtype=np.float32)
        c = np.zeros((batch, self.hidden_size), dtype=np.float32)
        outputs = []
        for t in range(timesteps):
            x_t = X[:, t, :]
            combined = np.concatenate([x_t, h], axis=1)
            f = _sigmoid(combined @ self.Wf + self.bf)
            i = _sigmoid(combined @ self.Wi + self.bi)
            c_hat = _tanh(combined @ self.Wc + self.bc)
            o = _sigmoid(combined @ self.Wo + self.bo)
            c = f * c + i * c_hat
            h = o * _tanh(c)
            if training and dropout_rate > 0 and rng is not None:
                mask = (rng.random(h.shape) > dropout_rate).astype(np.float32) / (1 - dropout_rate)
                h = h * mask
            outputs.append(h.copy())
        if return_sequences:
            return np.stack(outputs, axis=1)  # (batch, timesteps, hidden)
        return outputs[-1]  # (batch, hidden)

    def _grads_numerical(self, X, target_grad, return_sequences, dropout_rate, rng):
        """Backprop through time (BPTT) for this LSTM cell."""
        batch, timesteps, feat_size = X.shape
        hs = np.zeros((batch, self.hidden_size), dtype=np.float32)
        cs = np.zeros((batch, self.hidden_size), dtype=np.float32)

        # Forward pass storing intermediates
        h_list, c_list, f_list, i_list, ch_list, o_list, comb_list = [], [], [], [], [], [], []
        h_prev_list = [hs.copy()]
        c_prev_list = [cs.copy()]
        h = hs
        c = cs
        for t in range(timesteps):
            x_t = X[:, t, :]
            combined = np.concatenate([x_t, h], axis=1)
            f = _sigmoid(combined @ self.Wf + self.bf)
            iv = _sigmoid(combined @ self.Wi + self.bi)
            c_hat = _tanh(combined @ self.Wc + self.bc)
            o = _sigmoid(combined @ self.Wo + self.bo)
            c = f * c + iv * c_hat
            h = o * _tanh(c)
            comb_list.append(combined)
            f_list.append(f)
            i_list.append(iv)
            ch_list.append(c_hat)
            o_list.append(o)
            h_list.append(h)
            c_list.append(c)
            if t < timesteps - 1:
                h_prev_list.append(h.copy())
                c_prev_list.append(c.copy())

        # Backward pass
        dWf = np.zeros_like(self.Wf)
        dWi = np.zeros_like(self.Wi)
        dWc = np.zeros_like(self.Wc)
        dWo = np.zeros_like(self.Wo)
        dbf = np.zeros_like(self.bf)
        dbi = np.zeros_like(self.bi)
        dbc = np.zeros_like(self.bc)
        dbo = np.zeros_like(self.bo)

        dh_next = np.zeros((batch, self.hidden_size), dtype=np.float32)
        dc_next = np.zeros((batch, self.hidden_size), dtype=np.float32)

        for t in reversed(range(timesteps)):
            if return_sequences:
                dh = target_grad[:, t, :] + dh_next
            else:
                dh = (target_grad if t == timesteps - 1 else np.zeros_like(target_grad)) + dh_next

            o = o_list[t]
            c_val = c_list[t]
            tanh_c = _tanh(c_val)
            do = dh * tanh_c * o * (1 - o)
            dc = dh * o * (1 - tanh_c ** 2) + dc_next

            f = f_list[t]
            iv = i_list[t]
            c_hat = ch_list[t]
            c_prev = c_prev_list[t] if t < len(c_prev_list) else np.zeros_like(c_val)

            df = dc * c_prev * f * (1 - f)
            di = dc * c_hat * iv * (1 - iv)
            dc_hat = dc * iv * (1 - c_hat ** 2)

            combined = comb_list[t]
            dWf += combined.T @ df
            dbf += df.sum(axis=0)
            dWi += combined.T @ di
            dbi += di.sum(axis=0)
            dWc += combined.T @ dc_hat
            dbc += dc_hat.sum(axis=0)
            dWo += combined.T @ do
            dbo += do.sum(axis=0)

            dcombined = df @ self.Wf.T + di @ self.Wi.T + dc_hat @ self.Wc.T + do @ self.Wo.T
            dh_next = dcombined[:, feat_size:]
            dc_next = dc * f

        return dWf, dbf, dWi, dbi, dWc, dbc, dWo, dbo


class _Dense:
    """Simple dense (linear) layer."""

    def __init__(self, input_size, output_size, rng):
        scale = np.sqrt(2.0 / (input_size + output_size))
        self.W = rng.normal(0, scale, (input_size, output_size)).astype(np.float32)
        self.b = np.zeros(output_size, dtype=np.float32)

    def forward(self, X):
        return X @ self.W + self.b


class NumpyLSTMModel:
    """
    Two-layer LSTM model: LSTM(32, return_sequences=True) → LSTM(16) → Dense(1).
    Trained with Adam optimizer and MSE loss.
    """

    def __init__(self, lookback, seed=42):
        self.lookback = lookback
        self.rng = np.random.RandomState(seed)
        self.lstm1 = _LSTMCell(1, 32, self.rng)
        self.lstm2 = _LSTMCell(32, 16, self.rng)
        self.dense = _Dense(16, 1, self.rng)
        self.dropout_rate = 0.2

    def predict(self, X):
        """Forward pass (inference, no dropout)."""
        h1 = self.lstm1.forward_sequence(X, return_sequences=True)
        h2 = self.lstm2.forward_sequence(h1, return_sequences=False)
        return self.dense.forward(h2)

    def fit(self, X, y, epochs=100, batch_size=16, patience=10, verbose=0):
        """Train with Adam and early stopping."""
        n = len(X)
        y = y.reshape(-1, 1) if y.ndim == 1 else y
        best_loss = float("inf")
        wait = 0
        # Adam state
        adam_params = self._init_adam()
        t_step = 0

        for epoch in range(epochs):
            indices = self.rng.permutation(n)
            epoch_loss = 0.0
            n_batches = 0
            for start in range(0, n, batch_size):
                idx = indices[start:start + batch_size]
                Xb = X[idx]
                yb = y[idx]
                t_step += 1

                # Forward
                h1 = self.lstm1.forward_sequence(Xb, return_sequences=True,
                                                  dropout_rate=self.dropout_rate,
                                                  training=True, rng=self.rng)
                h2 = self.lstm2.forward_sequence(h1, return_sequences=False,
                                                  dropout_rate=self.dropout_rate,
                                                  training=True, rng=self.rng)
                out = self.dense.forward(h2)

                # MSE loss
                bs = len(Xb)
                loss = np.mean((out - yb) ** 2)
                epoch_loss += loss
                n_batches += 1

                # Backward - Dense
                d_out = 2.0 * (out - yb) / bs
                dW_dense = h2.T @ d_out
                db_dense = d_out.sum(axis=0)
                dh2 = d_out @ self.dense.W.T

                # Backward - LSTM2
                grads2 = self.lstm2._grads_numerical(h1, dh2, return_sequences=False,
                                                      dropout_rate=self.dropout_rate, rng=self.rng)
                # Backward - LSTM1 (simplified: use approximate gradient from LSTM2's input grad)
                dh1 = self._approx_lstm2_input_grad(h1, dh2)
                grads1 = self.lstm1._grads_numerical(Xb, dh1, return_sequences=True,
                                                      dropout_rate=self.dropout_rate, rng=self.rng)

                # Collect and apply Adam
                all_grads = list(grads1) + list(grads2) + [dW_dense, db_dense]
                self._adam_step(adam_params, all_grads, t_step)

            avg_loss = epoch_loss / max(n_batches, 1)
            if avg_loss < best_loss:
                best_loss = avg_loss
                wait = 0
            else:
                wait += 1
                if wait >= patience:
                    break

    def _approx_lstm2_input_grad(self, h1, dh2):
        """Approximate gradient of loss w.r.t. LSTM1 output (h1)."""
        batch, timesteps, hidden = h1.shape
        dh1 = np.zeros_like(h1)
        # Distribute the gradient from LSTM2 across timesteps
        # (simplified: weight towards later timesteps)
        weights = np.linspace(0.1, 1.0, timesteps)
        weights /= weights.sum()
        for t in range(timesteps):
            # Project dh2 back through approximate weights
            dh1[:, t, :] = (dh2 @ self.lstm2.Wf[:hidden, :].T)[:, :hidden] * weights[t]
        return dh1

    def _init_adam(self, lr=0.001, beta1=0.9, beta2=0.999, eps=1e-8):
        params = self._get_all_params()
        return {
            "lr": lr, "beta1": beta1, "beta2": beta2, "eps": eps,
            "m": [np.zeros_like(p) for p in params],
            "v": [np.zeros_like(p) for p in params],
        }

    def _get_all_params(self):
        return [
            self.lstm1.Wf, self.lstm1.bf, self.lstm1.Wi, self.lstm1.bi,
            self.lstm1.Wc, self.lstm1.bc, self.lstm1.Wo, self.lstm1.bo,
            self.lstm2.Wf, self.lstm2.bf, self.lstm2.Wi, self.lstm2.bi,
            self.lstm2.Wc, self.lstm2.bc, self.lstm2.Wo, self.lstm2.bo,
            self.dense.W, self.dense.b,
        ]

    def _set_all_params(self, values):
        params = self._get_all_params()
        for p, v in zip(params, values):
            p[:] = v

    def _adam_step(self, state, grads, t):
        params = self._get_all_params()
        lr, b1, b2, eps = state["lr"], state["beta1"], state["beta2"], state["eps"]
        for i, (p, g) in enumerate(zip(params, grads)):
            g = np.clip(g, -1.0, 1.0)  # Gradient clipping
            state["m"][i] = b1 * state["m"][i] + (1 - b1) * g
            state["v"][i] = b2 * state["v"][i] + (1 - b2) * g ** 2
            m_hat = state["m"][i] / (1 - b1 ** t)
            v_hat = state["v"][i] / (1 - b2 ** t)
            p -= lr * m_hat / (np.sqrt(v_hat) + eps)
