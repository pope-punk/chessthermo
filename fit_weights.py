#!/usr/bin/env python3
"""
Fit the thermodynamic evaluation weights from a PGN database.

Reimplements the lattice field theory feature extraction from
chess_thermodynamics.html, then fits the 405-parameter equation
of state (27 linear + 378 quadratic) via logistic regression on
game outcomes.

Requirements:
    pip install python-chess scikit-learn numpy

Usage:
    python3 fit_weights.py games.pgn [--max-games 50000] [--sample-every 8]

Recommended data source:
    Lichess Elite Database (2400+ vs 2200+): https://database.nikonoel.fr/
    Download a monthly PGN file, decompress with: pzstd -d file.pgn.zst

Output:
    Prints fitted weights as JS code to paste into createSeeded() in the HTML.
"""

import sys
import math
import argparse
import numpy as np
import chess
import chess.pgn
from sklearn.linear_model import LogisticRegression

# -------------------------------------------------------------------------
#  Constants matching the JS engine
# -------------------------------------------------------------------------
NF = 27
NQ = NF * (NF + 1) // 2

# Feature indices
F_SW, F_SB, F_DS = 0, 1, 2
F_D1W, F_D1B, F_D2W, F_D2B = 3, 4, 5, 6
F_Q11W, F_Q11B, F_Q22W, F_Q22B, F_Q12W, F_Q12B = 7, 8, 9, 10, 11, 12
F_AWK, F_DWK, F_ABK, F_DBK = 13, 14, 15, 16
F_ETAW, F_ETAB = 17, 18
F_PW, F_PB, F_PADVW, F_PADVB, F_PSPRW, F_PSPRB = 19, 20, 21, 22, 23, 24
F_TAU, F_T0 = 25, 26

# Precompute Green's function: G(x,s) = 1/(1 + d_chebyshev(x,s))
GREEN = np.zeros((64, 64), dtype=np.float64)
for a in range(64):
    for b in range(64):
        d = max(abs((a & 7) - (b & 7)), abs((a >> 3) - (b >> 3)))
        GREEN[a, b] = 1.0 / (1.0 + d)

# Piece type mapping: python-chess piece_type (1-6) to our constants
# chess.PAWN=1, chess.KNIGHT=2, chess.BISHOP=3, chess.ROOK=4, chess.QUEEN=5, chess.KING=6
PIECE_WEIGHTS_DEFAULT = {
    chess.PAWN: 0.5,    # wPawn
    chess.KING: 0.3,    # wKing
}

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

        # Captures (including en passant)
        for df in (-1, 1):
            nf = f + df
            nr = r + direction
            if 0 <= nf < 8 and 0 <= nr < 8:
                to_sq = nr * 8 + nf
                target = board.piece_at(to_sq)
                if (target and target.color == enemy) or to_sq == (board.ep_square if board.ep_square is not None else -1):
                    cnt += 1
        # Forward
        fwd = sq + direction * 8
        if 0 <= fwd < 64 and board.piece_at(fwd) is None:
            cnt += 1
            if r == start_rank:
                f2 = sq + direction * 16
                if 0 <= f2 < 64 and board.piece_at(f2) is None:
                    cnt += 1

    elif pt == chess.KNIGHT:
        for dr, df in [(-2,-1),(-2,1),(-1,-2),(-1,2),(1,-2),(1,2),(2,-1),(2,1)]:
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
def compute_features(board: chess.Board, w_pawn=0.5, w_king=0.3) -> np.ndarray:
    feat = np.zeros(NF, dtype=np.float64)
    srcW = np.zeros(64, dtype=np.float64)
    srcB = np.zeros(64, dtype=np.float64)
    wk_sq = bk_sq = -1
    n_pawns = n_thermal = 0
    pawn_count_w = pawn_count_b = 0
    pawn_adv_w = pawn_adv_b = 0
    pawn_files_w = []
    pawn_files_b = []

    # Pass 1: source charges q = log(1+m)
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

        mob = piece_mobility(board, sq)
        q = math.log(1 + mob)

        weight = 1.0
        if pt == chess.PAWN:
            weight = w_pawn
            n_pawns += 1
            if color == chess.WHITE:
                pawn_count_w += 1
                pawn_adv_w += (sq >> 3) - 1
                pawn_files_w.append(sq & 7)
            else:
                pawn_count_b += 1
                pawn_adv_b += 6 - (sq >> 3)
                pawn_files_b.append(sq & 7)
        elif pt == chess.KING:
            weight = w_king
        else:
            n_thermal += 1

        if color == chess.WHITE:
            srcW[sq] = q * weight
        else:
            srcB[sq] = q * weight

    # Pass 2: propagate via Green's function
    rhoW = GREEN @ srcW
    rhoB = GREEN @ srcB

    # Monopole
    Sw = srcW.sum()
    Sb = srcB.sum()
    feat[F_SW] = Sw
    feat[F_SB] = Sb
    feat[F_DS] = Sw - Sb

    # Dilution
    V = 62 - n_pawns
    N = n_thermal
    feat[F_T0] = V / N if N > 0 else 99.0

    # Center of entropy
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

    # Anchor: e1 points toward rank 8
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

    # Meta-entropy
    if Sw > 1e-12:
        eta = 0.0
        for sq in range(64):
            if srcW[sq] > 0:
                p = srcW[sq] / Sw
                eta -= p * math.log(p)
        feat[F_ETAW] = eta

    if Sb > 1e-12:
        eta = 0.0
        for sq in range(64):
            if srcB[sq] > 0:
                p = srcB[sq] / Sb
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
    """Expand 27 features into 27 + 378 = 405 features (linear + upper-triangle quadratic)."""
    quad = []
    for i in range(NF):
        for j in range(i, NF):
            quad.append(feat[i] * feat[j])
    return np.concatenate([feat, np.array(quad)])


# -------------------------------------------------------------------------
#  Extract labeled positions from a PGN file
# -------------------------------------------------------------------------
FEATURE_NAMES = [
    "SW", "SB", "DS", "D1W", "D1B", "D2W", "D2B",
    "Q11W", "Q11B", "Q22W", "Q22B", "Q12W", "Q12B",
    "AWK", "DWK", "ABK", "DBK",
    "ETAW", "ETAB",
    "PW", "PB", "PADVW", "PADVB", "PSPRW", "PSPRB",
    "TAU", "T0"
]


def extract_positions(pgn_path, max_games=50000, sample_every=8, skip_opening=10):
    """
    Parse PGN, replay games, sample positions, compute features.

    Args:
        pgn_path: Path to PGN file
        max_games: Maximum games to process
        sample_every: Sample one position every N half-moves
        skip_opening: Skip the first N half-moves (opening book)

    Returns:
        X: array of shape (n_positions, 405) - expanded feature vectors
        y: array of shape (n_positions,) - game results (1.0/0.5/0.0 from White's POV)
    """
    features_list = []
    labels = []

    with open(pgn_path, "r", errors="replace") as pgn_file:
        game_count = 0
        while game_count < max_games:
            game = chess.pgn.read_game(pgn_file)
            if game is None:
                break

            # Parse result
            result = game.headers.get("Result", "*")
            if result == "1-0":
                label = 1.0
            elif result == "0-1":
                label = 0.0
            elif result == "1/2-1/2":
                label = 0.5
            else:
                continue  # Skip unfinished games

            game_count += 1
            if game_count % 1000 == 0:
                print(f"  Processed {game_count} games, {len(features_list)} positions...",
                      file=sys.stderr)

            # Replay moves and sample positions
            board = game.board()
            ply = 0
            for move in game.mainline_moves():
                board.push(move)
                ply += 1

                if ply <= skip_opening:
                    continue
                if ply % sample_every != 0:
                    continue

                # Compute features and expand
                feat = compute_features(board)
                expanded = expand_quadratic(feat)
                features_list.append(expanded)
                labels.append(label)

    X = np.array(features_list, dtype=np.float64)
    y = np.array(labels, dtype=np.float64)
    print(f"  Total: {game_count} games, {len(y)} positions extracted.", file=sys.stderr)
    return X, y


# -------------------------------------------------------------------------
#  Fit and emit weights
# -------------------------------------------------------------------------
def fit_weights(X, y):
    """Fit logistic regression: P(white wins) = sigmoid(w . x)."""
    from sklearn.preprocessing import StandardScaler

    # Normalize features for stable optimization, then rescale coefficients back
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    # Convert 0/0.5/1 labels to binary for logistic regression
    # Draws become both win and loss with weight 0.5
    n = len(y)
    X_fit = []
    y_fit = []
    w_fit = []

    for i in range(n):
        if y[i] == 0.5:
            X_fit.append(X_scaled[i])
            y_fit.append(1)
            w_fit.append(0.5)
            X_fit.append(X_scaled[i])
            y_fit.append(0)
            w_fit.append(0.5)
        else:
            X_fit.append(X_scaled[i])
            y_fit.append(int(y[i]))
            w_fit.append(1.0)

    X_fit = np.array(X_fit)
    y_fit = np.array(y_fit)
    w_fit = np.array(w_fit)

    print(f"  Fitting logistic regression on {len(y_fit)} samples "
          f"({X_fit.shape[1]} features)...", file=sys.stderr)

    model = LogisticRegression(
        max_iter=5000,
        C=0.1,
        solver="lbfgs",
        fit_intercept=False,
        verbose=1,
    )
    model.fit(X_fit, y_fit, sample_weight=w_fit)

    # Rescale coefficients back to original feature space
    coeffs_scaled = model.coef_[0]
    scale = scaler.scale_
    scale[scale < 1e-12] = 1.0
    coeffs = coeffs_scaled / scale

    print(f"  Converged. Coefficient norm (original space): "
          f"{np.linalg.norm(coeffs):.4f}", file=sys.stderr)
    return coeffs


def emit_js(coeffs, w_pawn=0.5, w_king=0.3):
    """Print the fitted weights as JS code for the HTML file."""
    lin = coeffs[:NF]
    quad = coeffs[NF:]

    print("// ---- Fitted weights from PGN database (Texel-style) ----")
    print(f"// {NF} linear + {NQ} quadratic = {NF + NQ} parameters")
    print(f"// wPawn={w_pawn}, wKing={w_king}")
    print()

    print("function createSeeded(){")
    print("  const ind=new Individual();")
    print(f"  ind.wPawn={w_pawn};ind.wKing={w_king};")
    print()
    print("  // Linear weights")
    for i in range(NF):
        if abs(lin[i]) > 1e-8:
            print(f"  ind.wLin[{i}]={lin[i]:.6f}; // {FEATURE_NAMES[i]}")
    print()
    print("  // Quadratic weights (only non-negligible)")
    idx = 0
    for i in range(NF):
        for j in range(i, NF):
            if abs(quad[idx]) > 1e-6:
                print(f"  ind.setQ({i},{j},{quad[idx]:.6f}); "
                      f"// {FEATURE_NAMES[i]}*{FEATURE_NAMES[j]}")
            idx += 1
    print()
    print("  return ind;")
    print("}")

    # Also emit as compact arrays for easy pasting
    print()
    print("// ---- Compact array form ----")
    print("// ind.wLin = new Float64Array([")
    for i in range(0, NF, 9):
        chunk = lin[i:i+9]
        print("//   " + ",".join(f"{v:.6f}" for v in chunk) + ",")
    print("// ]);")
    print("// ind.wQuad = new Float64Array([")
    for i in range(0, NQ, 10):
        chunk = quad[i:i+10]
        print("//   " + ",".join(f"{v:.6f}" for v in chunk) + ",")
    print("// ]);")


# -------------------------------------------------------------------------
#  Main
# -------------------------------------------------------------------------
def main():
    parser = argparse.ArgumentParser(description="Fit thermodynamic eval weights from PGN")
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

    # Report class balance
    wins = (y == 1.0).sum()
    draws = (y == 0.5).sum()
    losses = (y == 0.0).sum()
    print(f"  Results: {wins} White wins, {draws} draws, {losses} Black wins", file=sys.stderr)

    print("Fitting equation of state...", file=sys.stderr)
    coeffs = fit_weights(X, y)

    # Report feature importance (top 10 linear)
    lin = coeffs[:NF]
    ranked = sorted(range(NF), key=lambda i: abs(lin[i]), reverse=True)
    print("\nTop 10 linear features by |weight|:", file=sys.stderr)
    for rank, i in enumerate(ranked[:10]):
        print(f"  {rank+1}. {FEATURE_NAMES[i]:6s} = {lin[i]:+.4f}", file=sys.stderr)

    print("\n--- JS output below ---\n", file=sys.stderr)
    emit_js(coeffs)


if __name__ == "__main__":
    main()
