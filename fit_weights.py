#!/usr/bin/env python3
"""
Fit the thermodynamic PV (potential energy) weights from a PGN database.

Reimplements the Gibbs free energy feature extraction from
chess_thermodynamics.html:
  - U = internal energy (total xray mobility per side)
  - T = temperature (move concentration = M/exp(H) where H = Shannon entropy)
  - S = entropy (xray redundancy = 1 - |union xray squares| / sum(xray per piece))
  - dF = (U_w - T_w*S_w) - (U_b - T_b*S_b)

PV is the potential energy, fitted via OLS so PV ~ dF at equilibrium.
Engine eval = dF - PV.

Requirements:
    pip install python-chess scikit-learn numpy

Usage:
    python3 fit_weights.py games.pgn [--max-games 50000] [--sample-every 8]

Recommended data source:
    Lichess Elite Database (2400+ vs 2200+): https://database.nikonoel.fr/
    Download a monthly PGN file, decompress with: pzstd -d file.pgn.zst

Output:
    Prints fitted PV weights as JS code to paste into
    createSeeded() in the HTML. Engine eval = dF - PV.
"""

import sys
import math
import argparse
import numpy as np
import chess
import chess.pgn
from sklearn.linear_model import Ridge

# -------------------------------------------------------------------------
#  Constants matching the JS engine
# -------------------------------------------------------------------------
NF_TOTAL = 29
NF = 23  # interaction features (indices 6..28 of full feature vector)
NQ = NF * (NF + 1) // 2  # 276
INT_OFF = 6

# Full feature indices
F_UW, F_UB = 0, 1
F_TW, F_TB = 2, 3
F_SW, F_SB = 4, 5
F_D1W, F_D1B, F_D2W, F_D2B = 6, 7, 8, 9
F_Q11W, F_Q11B, F_Q22W, F_Q22B, F_Q12W, F_Q12B = 10, 11, 12, 13, 14, 15
F_AWK, F_DWK, F_ABK, F_DBK = 16, 17, 18, 19
F_ETAW, F_ETAB = 20, 21
F_PW, F_PB, F_PADVW, F_PADVB, F_PSPRW, F_PSPRB = 22, 23, 24, 25, 26, 27
F_TAU = 28

# Precompute Green's function: G(x,s) = 1/(1 + d_chebyshev(x,s))
GREEN = np.zeros((64, 64), dtype=np.float64)
for a in range(64):
    for b in range(64):
        d = max(abs((a & 7) - (b & 7)), abs((a >> 3) - (b >> 3)))
        GREEN[a, b] = 1.0 / (1.0 + d)

KNIGHT_OFFSETS = [(-2, -1), (-2, 1), (-1, -2), (-1, 2), (1, -2), (1, 2), (2, -1), (2, 1)]
SLIDE_DIRS_MAP = {
    chess.BISHOP: [(1, 1), (1, -1), (-1, 1), (-1, -1)],
    chess.ROOK: [(0, 1), (0, -1), (1, 0), (-1, 0)],
    chess.QUEEN: [(0, 1), (0, -1), (1, 0), (-1, 0), (1, 1), (1, -1), (-1, 1), (-1, -1)],
}


def xray_mobility(piece_type: int, sq: int, color: bool) -> int:
    r, f = sq >> 3, sq & 7
    if piece_type == chess.PAWN:
        d = 1 if color == chess.WHITE else -1
        c = 0
        nr = r + d
        if 0 <= nr <= 7:
            c += 1
            if f > 0: c += 1
            if f < 7: c += 1
        if r == (1 if color == chess.WHITE else 6):
            c += 1
        return c
    if piece_type == chess.KNIGHT:
        return sum(1 for dr, df in KNIGHT_OFFSETS if 0 <= r + dr <= 7 and 0 <= f + df <= 7)
    if piece_type == chess.KING:
        c = 0
        for dr in (-1, 0, 1):
            for df in (-1, 0, 1):
                if dr == 0 and df == 0:
                    continue
                if 0 <= r + dr <= 7 and 0 <= f + df <= 7:
                    c += 1
        return c
    dirs = SLIDE_DIRS_MAP.get(piece_type, [])
    c = 0
    for dr, df in dirs:
        cr, cf = r + dr, f + df
        while 0 <= cr <= 7 and 0 <= cf <= 7:
            c += 1
            cr += dr
            cf += df
    return c


def add_xray_squares(piece_type: int, sq: int, color: bool, cov: np.ndarray):
    """Mark all xray squares for a piece into a coverage map."""
    r, f = sq >> 3, sq & 7
    if piece_type == chess.PAWN:
        d = 1 if color == chess.WHITE else -1
        nr = r + d
        if 0 <= nr <= 7:
            cov[nr * 8 + f] += 1
            if f > 0: cov[nr * 8 + f - 1] += 1
            if f < 7: cov[nr * 8 + f + 1] += 1
        if r == (1 if color == chess.WHITE else 6):
            cov[(r + d * 2) * 8 + f] += 1
        return
    if piece_type == chess.KNIGHT:
        for dr, df in KNIGHT_OFFSETS:
            nr, nf = r + dr, f + df
            if 0 <= nr < 8 and 0 <= nf < 8:
                cov[nr * 8 + nf] += 1
        return
    if piece_type == chess.KING:
        for dr in (-1, 0, 1):
            for df in (-1, 0, 1):
                if dr == 0 and df == 0:
                    continue
                nr, nf = r + dr, f + df
                if 0 <= nr < 8 and 0 <= nf < 8:
                    cov[nr * 8 + nf] += 1
        return
    dirs = SLIDE_DIRS_MAP.get(piece_type, [])
    for dr, df in dirs:
        cr, cf = r + dr, f + df
        while 0 <= cr < 8 and 0 <= cf < 8:
            cov[cr * 8 + cf] += 1
            cr += dr
            cf += df


def move_concentration(counts, total):
    """T = M / exp(H) where H = Shannon entropy of per-piece move distribution."""
    if total == 0:
        return 0.0
    H = 0.0
    for c in counts:
        if c > 0:
            p = c / total
            H -= p * math.log(p)
    return total / math.exp(H)


# -------------------------------------------------------------------------
#  Mobility computation (matches JS pieceMobility exactly)
# -------------------------------------------------------------------------
def piece_mobility(board: chess.Board, sq: int) -> int:
    piece = board.piece_at(sq)
    if piece is None:
        return 0

    pt = piece.piece_type
    color = piece.color
    r, f = sq >> 3, sq & 7

    cnt = 0

    if pt == chess.PAWN:
        direction = 1 if color == chess.WHITE else -1
        start_rank = 1 if color == chess.WHITE else 6
        enemy = not color

        for df in (-1, 1):
            nf = f + df
            nr = r + direction
            if 0 <= nf < 8 and 0 <= nr < 8:
                to_sq = nr * 8 + nf
                target = board.piece_at(to_sq)
                if (target and target.color == enemy) or to_sq == (board.ep_square if board.ep_square is not None else -1):
                    cnt += 1
        fwd = sq + direction * 8
        if 0 <= fwd < 64 and board.piece_at(fwd) is None:
            cnt += 1
            if r == start_rank:
                f2 = sq + direction * 16
                if 0 <= f2 < 64 and board.piece_at(f2) is None:
                    cnt += 1

    elif pt == chess.KNIGHT:
        for dr, df in KNIGHT_OFFSETS:
            nr, nf = r + dr, f + df
            if 0 <= nr < 8 and 0 <= nf < 8:
                target = board.piece_at(nr * 8 + nf)
                if target is None or target.color != color:
                    cnt += 1

    elif pt == chess.KING:
        for dr in (-1, 0, 1):
            for df in (-1, 0, 1):
                if dr == 0 and df == 0:
                    continue
                nr, nf = r + dr, f + df
                if 0 <= nr < 8 and 0 <= nf < 8:
                    target = board.piece_at(nr * 8 + nf)
                    if target is None or target.color != color:
                        cnt += 1

    else:  # Sliding pieces
        if pt == chess.BISHOP:
            dirs = [(1,1),(1,-1),(-1,1),(-1,-1)]
        elif pt == chess.ROOK:
            dirs = [(0,1),(0,-1),(1,0),(-1,0)]
        else:  # QUEEN
            dirs = [(0,1),(0,-1),(1,0),(-1,0),(1,1),(1,-1),(-1,1),(-1,-1)]

        for dr, df in dirs:
            cr, cf = r + dr, f + df
            while 0 <= cr < 8 and 0 <= cf < 8:
                target = board.piece_at(cr * 8 + cf)
                if target and target.color == color:
                    break
                cnt += 1
                if target:
                    break
                cr += dr
                cf += df

    return cnt


# -------------------------------------------------------------------------
#  Feature extraction (matches JS computeFeatures exactly)
# -------------------------------------------------------------------------
def compute_features(board: chess.Board) -> np.ndarray:
    feat = np.zeros(NF_TOTAL, dtype=np.float64)
    covW = np.zeros(64, dtype=np.int32)
    covB = np.zeros(64, dtype=np.int32)
    srcW = np.zeros(64, dtype=np.float64)
    srcB = np.zeros(64, dtype=np.float64)
    movesW = []
    movesB = []
    wk_sq = bk_sq = -1
    totalXrayW = totalXrayB = 0
    Uw = Ub = 0
    pawn_count_w = pawn_count_b = 0
    pawn_adv_w = pawn_adv_b = 0
    pawn_files_w = []
    pawn_files_b = []

    # Pass 1: per-piece metrics
    for sq in range(64):
        piece = board.piece_at(sq)
        if piece is None:
            continue

        pt = piece.piece_type
        color = piece.color

        if pt == chess.KING:
            if color == chess.WHITE:
                wk_sq = sq
            else:
                bk_sq = sq

        fi = xray_mobility(pt, sq, color)
        add_xray_squares(pt, sq, color, covW if color == chess.WHITE else covB)

        if color == chess.WHITE:
            srcW[sq] = fi
            totalXrayW += fi
        else:
            srcB[sq] = fi
            totalXrayB += fi

        mi = piece_mobility(board, sq)
        if color == chess.WHITE:
            Uw += mi
            movesW.append(mi)
        else:
            Ub += mi
            movesB.append(mi)

        if pt == chess.PAWN:
            if color == chess.WHITE:
                pawn_count_w += 1
                pawn_adv_w += (sq >> 3) - 1
                pawn_files_w.append(sq & 7)
            else:
                pawn_count_b += 1
                pawn_adv_b += 6 - (sq >> 3)
                pawn_files_b.append(sq & 7)

    # U (internal energy = total xray mobility)
    feat[F_UW] = totalXrayW
    feat[F_UB] = totalXrayB

    # T (temperature = move concentration)
    feat[F_TW] = move_concentration(movesW, Uw)
    feat[F_TB] = move_concentration(movesB, Ub)

    # S (xray redundancy = 1 - distinct/total)
    unionW = sum(1 for sq in range(64) if covW[sq] > 0)
    unionB = sum(1 for sq in range(64) if covB[sq] > 0)
    feat[F_SW] = 1 - unionW / totalXrayW if totalXrayW > 0 else 0
    feat[F_SB] = 1 - unionB / totalXrayB if totalXrayB > 0 else 0

    # Pass 2: propagate xray sources via Green's function
    rhoW = GREEN @ srcW
    rhoB = GREEN @ srcB

    # Center of field
    total_src = srcW + srcB
    total_abs = total_src.sum()
    if total_abs < 1e-12:
        total_abs = 1.0

    xs = np.array([sq & 7 for sq in range(64)], dtype=np.float64)
    ys = np.array([sq >> 3 for sq in range(64)], dtype=np.float64)
    cx = (total_src * xs).sum() / total_abs
    cy = (total_src * ys).sum() / total_abs

    # Inertia tensor
    dx = xs - cx
    dy = ys - cy
    I11 = (total_src * dx * dx).sum()
    I12 = (total_src * dx * dy).sum()
    I22 = (total_src * dy * dy).sum()

    # Eigendecomposition with sign anchoring
    tr = I11 + I22
    det = I11 * I22 - I12 * I12
    disc = math.sqrt(max(0, tr * tr - 4 * det))
    lam1 = (tr + disc) / 2
    lam2 = (tr - disc) / 2

    if abs(I12) > 1e-12:
        e1x = lam1 - I22
        e1y = I12
        n1 = math.sqrt(e1x * e1x + e1y * e1y)
        if n1 > 1e-12:
            e1x /= n1
            e1y /= n1
        else:
            e1x, e1y = 1.0, 0.0
        e2x, e2y = -e1y, e1x
    else:
        e1x, e1y = 1.0, 0.0
        e2x, e2y = 0.0, 1.0

    if e1y < 0:
        e1x, e1y = -e1x, -e1y
        e2x, e2y = -e2x, -e2y

    # Dipole and quadrupole in eigenbasis
    d1w = d1b = d2w = d2b = 0.0
    q11w = q11b = q22w = q22b = q12w = q12b = 0.0

    for sq in range(64):
        sw, sb = srcW[sq], srcB[sq]
        if sw <= 0 and sb <= 0:
            continue
        ddx = (sq & 7) - cx
        ddy = (sq >> 3) - cy
        u1 = ddx * e1x + ddy * e1y
        u2 = ddx * e2x + ddy * e2y
        if sw > 0:
            d1w += sw * u1; d2w += sw * u2
            q11w += sw * u1 * u1; q22w += sw * u2 * u2; q12w += sw * u1 * u2
        if sb > 0:
            d1b += sb * u1; d2b += sb * u2
            q11b += sb * u1 * u1; q22b += sb * u2 * u2; q12b += sb * u1 * u2

    feat[F_D1W] = d1w; feat[F_D1B] = d1b
    feat[F_D2W] = d2w; feat[F_D2B] = d2b
    feat[F_Q11W] = q11w; feat[F_Q11B] = q11b
    feat[F_Q22W] = q22w; feat[F_Q22B] = q22b
    feat[F_Q12W] = q12w; feat[F_Q12B] = q12b

    # King-field coupling
    if wk_sq >= 0 and bk_sq >= 0:
        kw_col = GREEN[:, wk_sq]
        kb_col = GREEN[:, bk_sq]
        feat[F_AWK] = (rhoB * kw_col).sum()
        feat[F_DWK] = (rhoW * kw_col).sum()
        feat[F_ABK] = (rhoW * kb_col).sum()
        feat[F_DBK] = (rhoB * kb_col).sum()

    # Meta-entropy (over raw xray totals, not log-transformed)
    if totalXrayW > 1e-12:
        eta = 0.0
        for sq in range(64):
            if srcW[sq] > 0:
                p = srcW[sq] / totalXrayW
                eta -= p * math.log(p)
        feat[F_ETAW] = eta

    if totalXrayB > 1e-12:
        eta = 0.0
        for sq in range(64):
            if srcB[sq] > 0:
                p = srcB[sq] / totalXrayB
                eta -= p * math.log(p)
        feat[F_ETAB] = eta

    # Pawn features
    feat[F_PW] = pawn_count_w
    feat[F_PB] = pawn_count_b
    feat[F_PADVW] = pawn_adv_w
    feat[F_PADVB] = pawn_adv_b

    if len(pawn_files_w) > 1:
        m = sum(pawn_files_w) / len(pawn_files_w)
        feat[F_PSPRW] = sum((f - m) ** 2 for f in pawn_files_w) / len(pawn_files_w)

    if len(pawn_files_b) > 1:
        m = sum(pawn_files_b) / len(pawn_files_b)
        feat[F_PSPRB] = sum((f - m) ** 2 for f in pawn_files_b) / len(pawn_files_b)

    # Spatial tension
    feat[F_TAU] = (rhoW * rhoB).sum()

    return feat


# -------------------------------------------------------------------------
#  Build quadratic feature vector from raw features
# -------------------------------------------------------------------------
def expand_quadratic(feat: np.ndarray) -> np.ndarray:
    n = len(feat)
    quad = []
    for i in range(n):
        for j in range(i, n):
            quad.append(feat[i] * feat[j])
    return np.concatenate([feat, np.array(quad)])


# -------------------------------------------------------------------------
#  Extract positions from a PGN file
# -------------------------------------------------------------------------
INTERACTION_NAMES = [
    "D1W", "D1B", "D2W", "D2B",
    "Q11W", "Q11B", "Q22W", "Q22B", "Q12W", "Q12B",
    "AWK", "DWK", "ABK", "DBK",
    "ETAW", "ETAB",
    "PW", "PB", "PADVW", "PADVB", "PSPRW", "PSPRB",
    "TAU"
]


def extract_positions(pgn_path, max_games=50000, sample_every=8, skip_opening=10):
    """
    Extract (interaction_features, dF) pairs from a PGN file.

    Positions from well-played games sit near thermodynamic equilibrium
    (G ~ 0), so PV ~ dF. We compute dF = (Uw - Tw*Sw) - (Ub - Tb*Sb)
    as the regression target and the 23 interaction features as predictors.

    Returns:
        X: array of shape (n_positions, NF + NQ) - expanded interaction features
        y: array of shape (n_positions,) - dF targets
    """
    features_list = []
    targets = []

    with open(pgn_path, "r", errors="replace") as pgn_file:
        game_count = 0
        while game_count < max_games:
            game = chess.pgn.read_game(pgn_file)
            if game is None:
                break

            result = game.headers.get("Result", "*")
            if result == "*":
                continue

            game_count += 1
            if game_count % 1000 == 0:
                print(f"  Processed {game_count} games, {len(features_list)} positions...",
                      file=sys.stderr)

            board = game.board()
            ply = 0
            for move in game.mainline_moves():
                board.push(move)
                ply += 1

                if ply <= skip_opening:
                    continue
                if ply % sample_every != 0:
                    continue

                feat = compute_features(board)
                target = (feat[F_UW] - feat[F_TW] * feat[F_SW]) - (feat[F_UB] - feat[F_TB] * feat[F_SB])
                interaction = feat[INT_OFF:INT_OFF + NF]
                expanded = expand_quadratic(interaction)
                features_list.append(expanded)
                targets.append(target)

    X = np.array(features_list, dtype=np.float64)
    y = np.array(targets, dtype=np.float64)
    print(f"  Total: {game_count} games, {len(y)} positions extracted.", file=sys.stderr)
    return X, y


# -------------------------------------------------------------------------
#  Fit and emit weights
# -------------------------------------------------------------------------
def fit_weights(X, y):
    """Fit PV = dF via ridge regression on interaction features."""
    from sklearn.preprocessing import StandardScaler

    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    print(f"  Fitting ridge regression: {len(y)} samples, "
          f"{X_scaled.shape[1]} features...", file=sys.stderr)

    model = Ridge(alpha=1.0, fit_intercept=False)
    model.fit(X_scaled, y)

    scale = scaler.scale_
    scale[scale < 1e-12] = 1.0
    coeffs = model.coef_ / scale

    r2 = model.score(X_scaled, y)
    residuals = y - X @ coeffs
    rmse = np.sqrt(np.mean(residuals ** 2))
    print(f"  R² = {r2:.4f}, RMSE = {rmse:.2f}", file=sys.stderr)
    return coeffs


def emit_js(coeffs):
    """Print the fitted PV weights as JS code."""
    lin = coeffs[:NF]
    quad = coeffs[NF:]

    print("// ---- Fitted PV weights (potential energy, OLS on dF) ----")
    print(f"// {NF} linear + {NQ} quadratic = {NF + NQ} parameters")
    print("// Engine eval = dF - PV")
    print()

    print("function createSeeded(){")
    print("  const ind=new Individual();")
    print()
    print("  // PV weights (potential energy)")
    for i in range(NF):
        if abs(lin[i]) > 1e-8:
            print(f"  ind.wLin[{i}]={lin[i]:.6f}; // {INTERACTION_NAMES[i]}")
    print()
    print("  // Quadratic PV weights (only non-negligible)")
    idx = 0
    for i in range(NF):
        for j in range(i, NF):
            if abs(quad[idx]) > 1e-6:
                print(f"  ind.setQ({i},{j},{quad[idx]:.6f}); "
                      f"// {INTERACTION_NAMES[i]}*{INTERACTION_NAMES[j]}")
            idx += 1
    print()
    print("  return ind;")
    print("}")


# -------------------------------------------------------------------------
#  Main
# -------------------------------------------------------------------------
def main():
    parser = argparse.ArgumentParser(description="Fit thermodynamic PV weights from PGN")
    parser.add_argument("pgn", help="Path to PGN file")
    parser.add_argument("--max-games", type=int, default=50000,
                        help="Maximum games to process (default: 50000)")
    parser.add_argument("--sample-every", type=int, default=8,
                        help="Sample one position every N half-moves (default: 8)")
    parser.add_argument("--skip-opening", type=int, default=10,
                        help="Skip first N half-moves (default: 10)")
    args = parser.parse_args()

    print(f"Extracting positions from {args.pgn}...", file=sys.stderr)
    X, y = extract_positions(args.pgn, args.max_games, args.sample_every, args.skip_opening)

    if len(y) < 100:
        print("ERROR: Too few positions extracted. Need at least 100.", file=sys.stderr)
        sys.exit(1)

    print(f"  Target dF: mean={y.mean():.2f}, std={y.std():.2f}", file=sys.stderr)

    # Check for NaN/Inf in features or targets
    if np.any(np.isnan(X)) or np.any(np.isinf(X)):
        bad_cols = np.where(np.any(np.isnan(X) | np.isinf(X), axis=0))[0]
        print(f"WARNING: NaN/Inf in feature columns: {bad_cols}", file=sys.stderr)
        X = np.nan_to_num(X, nan=0.0, posinf=0.0, neginf=0.0)
    if np.any(np.isnan(y)) or np.any(np.isinf(y)):
        print(f"WARNING: NaN/Inf in targets, replacing with 0", file=sys.stderr)
        y = np.nan_to_num(y, nan=0.0, posinf=0.0, neginf=0.0)

    print("Fitting PV = dF...", file=sys.stderr)
    coeffs = fit_weights(X, y)

    lin = coeffs[:NF]
    ranked = sorted(range(NF), key=lambda i: abs(lin[i]), reverse=True)
    print("\nTop 10 PV features by |weight|:", file=sys.stderr)
    for rank, i in enumerate(ranked[:10]):
        print(f"  {rank+1}. {INTERACTION_NAMES[i]:6s} = {lin[i]:+.4f}", file=sys.stderr)

    print("\n--- JS output below ---\n", file=sys.stderr)
    emit_js(coeffs)


if __name__ == "__main__":
    main()
