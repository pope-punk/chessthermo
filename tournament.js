#!/usr/bin/env node
"use strict";

// ================================================================
// Chess.js v0.10.3 (extracted from chess_thermo_4.html)
// ================================================================
var Chess = function(fen) {
  var BLACK = 'b', WHITE = 'w', EMPTY = -1;
  var PAWN = 'p', KNIGHT = 'n', BISHOP = 'b', ROOK = 'r', QUEEN = 'q', KING = 'k';
  var SYMBOLS = 'pnbrqkPNBRQK';
  var DEFAULT_POSITION = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  var PAWN_OFFSETS = { b: [16, 32, 17, 15], w: [-16, -32, -17, -15] };
  var PIECE_OFFSETS = {
    n: [-18, -33, -31, -14, 18, 33, 31, 14],
    b: [-17, -15, 17, 15], r: [-16, 1, 16, -1],
    q: [-17, -16, -15, 1, 17, 16, 15, -1],
    k: [-17, -16, -15, 1, 17, 16, 15, -1]
  };
  var ATTACKS = [
    20, 0, 0, 0, 0, 0, 0, 24, 0, 0, 0, 0, 0, 0,20, 0,
     0,20, 0, 0, 0, 0, 0, 24, 0, 0, 0, 0, 0,20, 0, 0,
     0, 0,20, 0, 0, 0, 0, 24, 0, 0, 0, 0,20, 0, 0, 0,
     0, 0, 0,20, 0, 0, 0, 24, 0, 0, 0,20, 0, 0, 0, 0,
     0, 0, 0, 0,20, 0, 0, 24, 0, 0,20, 0, 0, 0, 0, 0,
     0, 0, 0, 0, 0,20, 2, 24, 2,20, 0, 0, 0, 0, 0, 0,
     0, 0, 0, 0, 0, 2,53, 56,53, 2, 0, 0, 0, 0, 0, 0,
    24,24,24,24,24,24,56,  0,56,24,24,24,24,24,24, 0,
     0, 0, 0, 0, 0, 2,53, 56,53, 2, 0, 0, 0, 0, 0, 0,
     0, 0, 0, 0, 0,20, 2, 24, 2,20, 0, 0, 0, 0, 0, 0,
     0, 0, 0, 0,20, 0, 0, 24, 0, 0,20, 0, 0, 0, 0, 0,
     0, 0, 0,20, 0, 0, 0, 24, 0, 0, 0,20, 0, 0, 0, 0,
     0, 0,20, 0, 0, 0, 0, 24, 0, 0, 0, 0,20, 0, 0, 0,
     0,20, 0, 0, 0, 0, 0, 24, 0, 0, 0, 0, 0,20, 0, 0,
    20, 0, 0, 0, 0, 0, 0, 24, 0, 0, 0, 0, 0, 0,20
  ];
  var RAYS = [
     17,  0,  0,  0,  0,  0,  0, 16,  0,  0,  0,  0,  0,  0, 15, 0,
      0, 17,  0,  0,  0,  0,  0, 16,  0,  0,  0,  0,  0, 15,  0, 0,
      0,  0, 17,  0,  0,  0,  0, 16,  0,  0,  0,  0, 15,  0,  0, 0,
      0,  0,  0, 17,  0,  0,  0, 16,  0,  0,  0, 15,  0,  0,  0, 0,
      0,  0,  0,  0, 17,  0,  0, 16,  0,  0, 15,  0,  0,  0,  0, 0,
      0,  0,  0,  0,  0, 17,  0, 16,  0, 15,  0,  0,  0,  0,  0, 0,
      0,  0,  0,  0,  0,  0, 17, 16, 15,  0,  0,  0,  0,  0,  0, 0,
      1,  1,  1,  1,  1,  1,  1,  0, -1, -1, -1,-1, -1, -1, -1, 0,
      0,  0,  0,  0,  0,  0,-15,-16,-17,  0,  0,  0,  0,  0,  0, 0,
      0,  0,  0,  0,  0,-15,  0,-16,  0,-17,  0,  0,  0,  0,  0, 0,
      0,  0,  0,  0,-15,  0,  0,-16,  0,  0,-17,  0,  0,  0,  0, 0,
      0,  0,  0,-15,  0,  0,  0,-16,  0,  0,  0,-17,  0,  0,  0, 0,
      0,  0,-15,  0,  0,  0,  0,-16,  0,  0,  0,  0,-17,  0,  0, 0,
      0,-15,  0,  0,  0,  0,  0,-16,  0,  0,  0,  0,  0,-17,  0, 0,
    -15,  0,  0,  0,  0,  0,  0,-16,  0,  0,  0,  0,  0,  0,-17
  ];
  var SHIFTS = { p: 0, n: 1, b: 2, r: 3, q: 4, k: 5 };
  var FLAGS = { NORMAL:'n', CAPTURE:'c', BIG_PAWN:'b', EP_CAPTURE:'e', PROMOTION:'p', KSIDE_CASTLE:'k', QSIDE_CASTLE:'q' };
  var BITS = { NORMAL:1, CAPTURE:2, BIG_PAWN:4, EP_CAPTURE:8, PROMOTION:16, KSIDE_CASTLE:32, QSIDE_CASTLE:64 };
  var RANK_1=7, RANK_2=6, RANK_7=1, RANK_8=0;
  var SQUARES = {
    a8:0,b8:1,c8:2,d8:3,e8:4,f8:5,g8:6,h8:7,
    a7:16,b7:17,c7:18,d7:19,e7:20,f7:21,g7:22,h7:23,
    a6:32,b6:33,c6:34,d6:35,e6:36,f6:37,g6:38,h6:39,
    a5:48,b5:49,c5:50,d5:51,e5:52,f5:53,g5:54,h5:55,
    a4:64,b4:65,c4:66,d4:67,e4:68,f4:69,g4:70,h4:71,
    a3:80,b3:81,c3:82,d3:83,e3:84,f3:85,g3:86,h3:87,
    a2:96,b2:97,c2:98,d2:99,e2:100,f2:101,g2:102,h2:103,
    a1:112,b1:113,c1:114,d1:115,e1:116,f1:117,g1:118,h1:119
  };
  var ROOKS = {
    w: [{square:SQUARES.a1,flag:BITS.QSIDE_CASTLE},{square:SQUARES.h1,flag:BITS.KSIDE_CASTLE}],
    b: [{square:SQUARES.a8,flag:BITS.QSIDE_CASTLE},{square:SQUARES.h8,flag:BITS.KSIDE_CASTLE}]
  };
  var board = new Array(128);
  var kings = { w: EMPTY, b: EMPTY };
  var turn = WHITE;
  var castling = { w: 0, b: 0 };
  var ep_square = EMPTY;
  var half_moves = 0;
  var move_number = 1;
  var history = [];
  var header = {};
  if (typeof fen === 'undefined') load(DEFAULT_POSITION); else load(fen);

  function clear(keep_headers) {
    if (typeof keep_headers === 'undefined') keep_headers = false;
    board = new Array(128); kings = { w: EMPTY, b: EMPTY };
    turn = WHITE; castling = { w: 0, b: 0 }; ep_square = EMPTY;
    half_moves = 0; move_number = 1; history = [];
    if (!keep_headers) header = {};
    update_setup(generate_fen());
  }
  function reset() { load(DEFAULT_POSITION); }
  function load(fen, keep_headers) {
    if (typeof keep_headers === 'undefined') keep_headers = false;
    var tokens = fen.split(/\s+/); var position = tokens[0]; var square = 0;
    if (!validate_fen(fen).valid) return false;
    clear(keep_headers);
    for (var i = 0; i < position.length; i++) {
      var piece = position.charAt(i);
      if (piece === '/') { square += 8; }
      else if (is_digit(piece)) { square += parseInt(piece, 10); }
      else {
        var color = piece < 'a' ? WHITE : BLACK;
        put({ type: piece.toLowerCase(), color: color }, algebraic(square)); square++;
      }
    }
    turn = tokens[1];
    if (tokens[2].indexOf('K') > -1) castling.w |= BITS.KSIDE_CASTLE;
    if (tokens[2].indexOf('Q') > -1) castling.w |= BITS.QSIDE_CASTLE;
    if (tokens[2].indexOf('k') > -1) castling.b |= BITS.KSIDE_CASTLE;
    if (tokens[2].indexOf('q') > -1) castling.b |= BITS.QSIDE_CASTLE;
    ep_square = tokens[3] === '-' ? EMPTY : SQUARES[tokens[3]];
    half_moves = parseInt(tokens[4], 10); move_number = parseInt(tokens[5], 10);
    update_setup(generate_fen()); return true;
  }
  function validate_fen(fen) {
    var errors = { 0:'No errors.', 1:'FEN string must contain six space-delimited fields.',
      2:'6th field (move number) must be a positive integer.',
      3:'5th field (half move counter) must be a non-negative integer.',
      4:'4th field (en-passant square) is invalid.', 5:'3rd field (castling availability) is invalid.',
      6:'2nd field (side to move) is invalid.',
      7:"1st field (piece positions) does not contain 8 '/'-delimited rows.",
      8:'1st field (piece positions) is invalid [consecutive numbers].',
      9:'1st field (piece positions) is invalid [invalid piece].',
      10:'1st field (piece positions) is invalid [row too large].',
      11:'Illegal en-passant square' };
    var tokens = fen.split(/\s+/);
    if (tokens.length !== 6) return { valid:false, error_number:1, error:errors[1] };
    if (isNaN(tokens[5]) || parseInt(tokens[5],10) <= 0) return { valid:false, error_number:2, error:errors[2] };
    if (isNaN(tokens[4]) || parseInt(tokens[4],10) < 0) return { valid:false, error_number:3, error:errors[3] };
    if (!/^(-|[abcdefgh][36])$/.test(tokens[3])) return { valid:false, error_number:4, error:errors[4] };
    if (!/^(KQ?k?q?|Qk?q?|kq?|q|-)$/.test(tokens[2])) return { valid:false, error_number:5, error:errors[5] };
    if (!/^(w|b)$/.test(tokens[1])) return { valid:false, error_number:6, error:errors[6] };
    var rows = tokens[0].split('/');
    if (rows.length !== 8) return { valid:false, error_number:7, error:errors[7] };
    for (var i = 0; i < rows.length; i++) {
      var sum_fields = 0, previous_was_number = false;
      for (var k = 0; k < rows[i].length; k++) {
        if (!isNaN(rows[i][k])) {
          if (previous_was_number) return { valid:false, error_number:8, error:errors[8] };
          sum_fields += parseInt(rows[i][k],10); previous_was_number = true;
        } else {
          if (!/^[prnbqkPRNBQK]$/.test(rows[i][k])) return { valid:false, error_number:9, error:errors[9] };
          sum_fields += 1; previous_was_number = false;
        }
      }
      if (sum_fields !== 8) return { valid:false, error_number:10, error:errors[10] };
    }
    if ((tokens[3][1]=='3' && tokens[1]=='w') || (tokens[3][1]=='6' && tokens[1]=='b'))
      return { valid:false, error_number:11, error:errors[11] };
    return { valid:true, error_number:0, error:errors[0] };
  }
  function generate_fen() {
    var empty = 0, fen = '';
    for (var i = SQUARES.a8; i <= SQUARES.h1; i++) {
      if (board[i] == null) { empty++; }
      else { if (empty > 0) { fen += empty; empty = 0; }
        var color = board[i].color; var piece = board[i].type;
        fen += color === WHITE ? piece.toUpperCase() : piece.toLowerCase();
      }
      if ((i + 1) & 0x88) { if (empty > 0) { fen += empty; }
        if (i !== SQUARES.h1) fen += '/'; empty = 0; i += 8;
      }
    }
    var cflags = '';
    if (castling[WHITE] & BITS.KSIDE_CASTLE) cflags += 'K';
    if (castling[WHITE] & BITS.QSIDE_CASTLE) cflags += 'Q';
    if (castling[BLACK] & BITS.KSIDE_CASTLE) cflags += 'k';
    if (castling[BLACK] & BITS.QSIDE_CASTLE) cflags += 'q';
    cflags = cflags || '-';
    var epflags = ep_square === EMPTY ? '-' : algebraic(ep_square);
    return [fen, turn, cflags, epflags, half_moves, move_number].join(' ');
  }
  function set_header(args) {
    for (var i = 0; i < args.length; i += 2)
      if (typeof args[i]==='string' && typeof args[i+1]==='string') header[args[i]] = args[i+1];
    return header;
  }
  function update_setup(fen) {
    if (history.length > 0) return;
    if (fen !== DEFAULT_POSITION) { header['SetUp']='1'; header['FEN']=fen; }
    else { delete header['SetUp']; delete header['FEN']; }
  }
  function get(square) {
    var piece = board[SQUARES[square]];
    return piece ? { type:piece.type, color:piece.color } : null;
  }
  function put(piece, square) {
    if (!('type' in piece && 'color' in piece)) return false;
    if (SYMBOLS.indexOf(piece.type.toLowerCase()) === -1) return false;
    if (!(square in SQUARES)) return false;
    var sq = SQUARES[square];
    if (piece.type == KING && !(kings[piece.color] == EMPTY || kings[piece.color] == sq)) return false;
    board[sq] = { type:piece.type, color:piece.color };
    if (piece.type === KING) kings[piece.color] = sq;
    update_setup(generate_fen()); return true;
  }
  function remove(square) {
    var piece = get(square); board[SQUARES[square]] = null;
    if (piece && piece.type === KING) kings[piece.color] = EMPTY;
    update_setup(generate_fen()); return piece;
  }
  function build_move(board, from, to, flags, promotion) {
    var move = { color:turn, from:from, to:to, flags:flags, piece:board[from].type };
    if (promotion) { move.flags |= BITS.PROMOTION; move.promotion = promotion; }
    if (board[to]) move.captured = board[to].type;
    else if (flags & BITS.EP_CAPTURE) move.captured = PAWN;
    return move;
  }
  function generate_moves(options) {
    function add_move(board, moves, from, to, flags) {
      if (board[from].type === PAWN && (rank(to) === RANK_8 || rank(to) === RANK_1)) {
        var pieces = [QUEEN, ROOK, BISHOP, KNIGHT];
        for (var i = 0, len = pieces.length; i < len; i++) moves.push(build_move(board, from, to, flags, pieces[i]));
      } else { moves.push(build_move(board, from, to, flags)); }
    }
    var moves = [], us = turn, them = swap_color(us);
    var second_rank = { b: RANK_7, w: RANK_2 };
    var first_sq = SQUARES.a8, last_sq = SQUARES.h1, single_square = false;
    var legal = typeof options !== 'undefined' && 'legal' in options ? options.legal : true;
    if (typeof options !== 'undefined' && 'square' in options) {
      if (options.square in SQUARES) { first_sq = last_sq = SQUARES[options.square]; single_square = true; }
      else return [];
    }
    for (var i = first_sq; i <= last_sq; i++) {
      if (i & 0x88) { i += 7; continue; }
      var piece = board[i];
      if (piece == null || piece.color !== us) continue;
      if (piece.type === PAWN) {
        var square = i + PAWN_OFFSETS[us][0];
        if (board[square] == null) {
          add_move(board, moves, i, square, BITS.NORMAL);
          square = i + PAWN_OFFSETS[us][1];
          if (second_rank[us] === rank(i) && board[square] == null)
            add_move(board, moves, i, square, BITS.BIG_PAWN);
        }
        for (var j = 2; j < 4; j++) {
          square = i + PAWN_OFFSETS[us][j];
          if (square & 0x88) continue;
          if (board[square] != null && board[square].color === them) add_move(board, moves, i, square, BITS.CAPTURE);
          else if (square === ep_square) add_move(board, moves, i, ep_square, BITS.EP_CAPTURE);
        }
      } else {
        for (var j = 0, len = PIECE_OFFSETS[piece.type].length; j < len; j++) {
          var offset = PIECE_OFFSETS[piece.type][j]; var square = i;
          while (true) {
            square += offset; if (square & 0x88) break;
            if (board[square] == null) { add_move(board, moves, i, square, BITS.NORMAL); }
            else { if (board[square].color === us) break; add_move(board, moves, i, square, BITS.CAPTURE); break; }
            if (piece.type === 'n' || piece.type === 'k') break;
          }
        }
      }
    }
    if (!single_square || last_sq === kings[us]) {
      if (castling[us] & BITS.KSIDE_CASTLE) {
        var castling_from = kings[us], castling_to = castling_from + 2;
        if (board[castling_from+1]==null && board[castling_to]==null &&
            !attacked(them,kings[us]) && !attacked(them,castling_from+1) && !attacked(them,castling_to))
          add_move(board, moves, kings[us], castling_to, BITS.KSIDE_CASTLE);
      }
      if (castling[us] & BITS.QSIDE_CASTLE) {
        var castling_from = kings[us], castling_to = castling_from - 2;
        if (board[castling_from-1]==null && board[castling_from-2]==null && board[castling_from-3]==null &&
            !attacked(them,kings[us]) && !attacked(them,castling_from-1) && !attacked(them,castling_to))
          add_move(board, moves, kings[us], castling_to, BITS.QSIDE_CASTLE);
      }
    }
    if (!legal) return moves;
    var legal_moves = [];
    for (var i = 0, len = moves.length; i < len; i++) {
      make_move(moves[i]);
      if (!king_attacked(us)) legal_moves.push(moves[i]);
      undo_move();
    }
    return legal_moves;
  }
  function generate_captures() {
    var moves = [], us = turn, them = swap_color(us);
    for (var i = SQUARES.a8; i <= SQUARES.h1; i++) {
      if (i & 0x88) { i += 7; continue; }
      var piece = board[i];
      if (piece == null || piece.color !== us) continue;
      if (piece.type === PAWN) {
        for (var j = 2; j < 4; j++) {
          var square = i + PAWN_OFFSETS[us][j];
          if (square & 0x88) continue;
          if (board[square] != null && board[square].color === them) {
            if (rank(square) === RANK_8 || rank(square) === RANK_1) {
              moves.push(build_move(board, i, square, BITS.CAPTURE, QUEEN));
              moves.push(build_move(board, i, square, BITS.CAPTURE, ROOK));
              moves.push(build_move(board, i, square, BITS.CAPTURE, BISHOP));
              moves.push(build_move(board, i, square, BITS.CAPTURE, KNIGHT));
            } else { moves.push(build_move(board, i, square, BITS.CAPTURE)); }
          } else if (square === ep_square) {
            moves.push(build_move(board, i, ep_square, BITS.EP_CAPTURE));
          }
        }
        var push_sq = i + PAWN_OFFSETS[us][0];
        if (!(push_sq & 0x88) && board[push_sq] == null &&
            (rank(push_sq) === RANK_8 || rank(push_sq) === RANK_1)) {
          moves.push(build_move(board, i, push_sq, BITS.NORMAL, QUEEN));
          moves.push(build_move(board, i, push_sq, BITS.NORMAL, KNIGHT));
        }
      } else {
        for (var j = 0, len = PIECE_OFFSETS[piece.type].length; j < len; j++) {
          var offset = PIECE_OFFSETS[piece.type][j]; var square = i;
          while (true) {
            square += offset; if (square & 0x88) break;
            if (board[square] == null) { if (piece.type==='n'||piece.type==='k') break; continue; }
            if (board[square].color === us) break;
            moves.push(build_move(board, i, square, BITS.CAPTURE)); break;
          }
        }
      }
    }
    var legal_moves = [];
    for (var i = 0, len = moves.length; i < len; i++) {
      make_move(moves[i]); if (!king_attacked(us)) legal_moves.push(moves[i]); undo_move();
    }
    return legal_moves;
  }
  function move_to_san(move, sloppy) {
    var output = '';
    if (move.flags & BITS.KSIDE_CASTLE) { output = 'O-O'; }
    else if (move.flags & BITS.QSIDE_CASTLE) { output = 'O-O-O'; }
    else {
      var disambiguator = get_disambiguator(move, sloppy);
      if (move.piece !== PAWN) output += move.piece.toUpperCase() + disambiguator;
      if (move.flags & (BITS.CAPTURE | BITS.EP_CAPTURE)) {
        if (move.piece === PAWN) output += algebraic(move.from)[0];
        output += 'x';
      }
      output += algebraic(move.to);
      if (move.flags & BITS.PROMOTION) output += '=' + move.promotion.toUpperCase();
    }
    make_move(move);
    if (in_check()) { if (in_checkmate()) output += '#'; else output += '+'; }
    undo_move();
    return output;
  }
  function stripped_san(move) { return move.replace(/=/, '').replace(/[+#]?[?!]*$/, ''); }
  function attacked(color, square) {
    for (var i = SQUARES.a8; i <= SQUARES.h1; i++) {
      if (i & 0x88) { i += 7; continue; }
      if (board[i] == null || board[i].color !== color) continue;
      var piece = board[i]; var difference = i - square; var index = difference + 119;
      if (ATTACKS[index] & (1 << SHIFTS[piece.type])) {
        if (piece.type === PAWN) {
          if (difference > 0) { if (piece.color === WHITE) return true; }
          else { if (piece.color === BLACK) return true; }
          continue;
        }
        if (piece.type === 'n' || piece.type === 'k') return true;
        var offset = RAYS[index]; var j = i + offset; var blocked = false;
        while (j !== square) { if (board[j] != null) { blocked = true; break; } j += offset; }
        if (!blocked) return true;
      }
    }
    return false;
  }
  function king_attacked(color) { return attacked(swap_color(color), kings[color]); }
  function in_check() { return king_attacked(turn); }
  function in_checkmate() { return in_check() && generate_moves().length === 0; }
  function in_stalemate() { return !in_check() && generate_moves().length === 0; }
  function insufficient_material() {
    var pieces = {}, bishops = [], num_pieces = 0, sq_color = 0;
    for (var i = SQUARES.a8; i <= SQUARES.h1; i++) {
      sq_color = (sq_color + 1) % 2; if (i & 0x88) { i += 7; continue; }
      var piece = board[i];
      if (piece) { pieces[piece.type] = piece.type in pieces ? pieces[piece.type]+1 : 1;
        if (piece.type === BISHOP) bishops.push(sq_color); num_pieces++;
      }
    }
    if (num_pieces === 2) return true;
    if (num_pieces === 3 && (pieces[BISHOP] === 1 || pieces[KNIGHT] === 1)) return true;
    if (num_pieces === pieces[BISHOP] + 2) {
      var sum = 0, len = bishops.length;
      for (var i = 0; i < len; i++) sum += bishops[i];
      if (sum === 0 || sum === len) return true;
    }
    return false;
  }
  function in_threefold_repetition() {
    var moves = [], positions = {}, repetition = false;
    while (true) { var move = undo_move(); if (!move) break; moves.push(move); }
    while (true) {
      var fen = generate_fen().split(' ').slice(0,4).join(' ');
      positions[fen] = fen in positions ? positions[fen]+1 : 1;
      if (positions[fen] >= 3) repetition = true;
      if (!moves.length) break; make_move(moves.pop());
    }
    return repetition;
  }
  function push(move) {
    history.push({ move:move, kings:{b:kings.b,w:kings.w}, turn:turn,
      castling:{b:castling.b,w:castling.w}, ep_square:ep_square,
      half_moves:half_moves, move_number:move_number });
  }
  function make_move(move) {
    var us = turn, them = swap_color(us); push(move);
    board[move.to] = board[move.from]; board[move.from] = null;
    if (move.flags & BITS.EP_CAPTURE) {
      if (turn === BLACK) board[move.to - 16] = null; else board[move.to + 16] = null;
    }
    if (move.flags & BITS.PROMOTION) board[move.to] = { type:move.promotion, color:us };
    if (board[move.to].type === KING) {
      kings[board[move.to].color] = move.to;
      if (move.flags & BITS.KSIDE_CASTLE) {
        var castling_to = move.to-1, castling_from = move.to+1;
        board[castling_to] = board[castling_from]; board[castling_from] = null;
      } else if (move.flags & BITS.QSIDE_CASTLE) {
        var castling_to = move.to+1, castling_from = move.to-2;
        board[castling_to] = board[castling_from]; board[castling_from] = null;
      }
      castling[us] = 0;
    }
    if (castling[us]) {
      for (var i = 0, len = ROOKS[us].length; i < len; i++) {
        if (move.from === ROOKS[us][i].square && castling[us] & ROOKS[us][i].flag)
          { castling[us] ^= ROOKS[us][i].flag; break; }
      }
    }
    if (castling[them]) {
      for (var i = 0, len = ROOKS[them].length; i < len; i++) {
        if (move.to === ROOKS[them][i].square && castling[them] & ROOKS[them][i].flag)
          { castling[them] ^= ROOKS[them][i].flag; break; }
      }
    }
    if (move.flags & BITS.BIG_PAWN) {
      if (turn === 'b') ep_square = move.to - 16; else ep_square = move.to + 16;
    } else { ep_square = EMPTY; }
    if (move.piece === PAWN) half_moves = 0;
    else if (move.flags & (BITS.CAPTURE | BITS.EP_CAPTURE)) half_moves = 0;
    else half_moves++;
    if (turn === BLACK) move_number++;
    turn = swap_color(turn);
  }
  function undo_move() {
    var old = history.pop(); if (old == null) return null;
    var move = old.move; kings = old.kings; turn = old.turn; castling = old.castling;
    ep_square = old.ep_square; half_moves = old.half_moves; move_number = old.move_number;
    var us = turn, them = swap_color(turn);
    board[move.from] = board[move.to]; board[move.from].type = move.piece; board[move.to] = null;
    if (move.flags & BITS.CAPTURE) board[move.to] = { type:move.captured, color:them };
    else if (move.flags & BITS.EP_CAPTURE) {
      var index; if (us === BLACK) index = move.to - 16; else index = move.to + 16;
      board[index] = { type:PAWN, color:them };
    }
    if (move.flags & (BITS.KSIDE_CASTLE | BITS.QSIDE_CASTLE)) {
      var castling_to, castling_from;
      if (move.flags & BITS.KSIDE_CASTLE) { castling_to = move.to+1; castling_from = move.to-1; }
      else if (move.flags & BITS.QSIDE_CASTLE) { castling_to = move.to-2; castling_from = move.to+1; }
      board[castling_to] = board[castling_from]; board[castling_from] = null;
    }
    return move;
  }
  function get_disambiguator(move, sloppy) {
    var moves = generate_moves({legal:!sloppy});
    var from = move.from, to = move.to, piece = move.piece;
    var ambiguities = 0, same_rank = 0, same_file = 0;
    for (var i = 0, len = moves.length; i < len; i++) {
      var ambig_from = moves[i].from, ambig_to = moves[i].to, ambig_piece = moves[i].piece;
      if (piece === ambig_piece && from !== ambig_from && to === ambig_to) {
        ambiguities++;
        if (rank(from) === rank(ambig_from)) same_rank++;
        if (file(from) === file(ambig_from)) same_file++;
      }
    }
    if (ambiguities > 0) {
      if (same_rank > 0 && same_file > 0) return algebraic(from);
      else if (same_file > 0) return algebraic(from).charAt(1);
      else return algebraic(from).charAt(0);
    }
    return '';
  }
  function move_from_san(move, sloppy) {
    var clean_move = stripped_san(move);
    if (sloppy) {
      var matches = clean_move.match(/([pnbrqkPNBRQK])?([a-h][1-8])x?-?([a-h][1-8])([qrbnQRBN])?/);
      if (matches) { var piece=matches[1], from=matches[2], to=matches[3], promotion=matches[4]; }
    }
    var moves = generate_moves();
    for (var i = 0, len = moves.length; i < len; i++) {
      if (clean_move === stripped_san(move_to_san(moves[i])) ||
          (sloppy && clean_move === stripped_san(move_to_san(moves[i], true)))) return moves[i];
      else if (matches && (!piece || piece.toLowerCase()==moves[i].piece) &&
               SQUARES[from]==moves[i].from && SQUARES[to]==moves[i].to &&
               (!promotion || promotion.toLowerCase()==moves[i].promotion)) return moves[i];
    }
    return null;
  }
  function rank(i) { return i >> 4; }
  function file(i) { return i & 15; }
  function algebraic(i) { var f=file(i), r=rank(i); return 'abcdefgh'.substring(f,f+1)+'87654321'.substring(r,r+1); }
  function swap_color(c) { return c === WHITE ? BLACK : WHITE; }
  function is_digit(c) { return '0123456789'.indexOf(c) !== -1; }
  function make_pretty(ugly_move) {
    var move = clone(ugly_move); move.san = move_to_san(move, false);
    move.to = algebraic(move.to); move.from = algebraic(move.from);
    var flags = '';
    for (var flag in BITS) { if (BITS[flag] & move.flags) flags += FLAGS[flag]; }
    move.flags = flags; return move;
  }
  function clone(obj) {
    var dupe = obj instanceof Array ? [] : {};
    for (var property in obj) { if (typeof property === 'object') dupe[property]=clone(obj[property]); else dupe[property]=obj[property]; }
    return dupe;
  }

  return {
    WHITE:WHITE, BLACK:BLACK, PAWN:PAWN, KNIGHT:KNIGHT, BISHOP:BISHOP, ROOK:ROOK, QUEEN:QUEEN, KING:KING,
    SQUARES: (function() { var keys=[]; for (var i=SQUARES.a8; i<=SQUARES.h1; i++) { if(i&0x88){i+=7;continue;} keys.push(algebraic(i)); } return keys; })(),
    FLAGS: FLAGS,
    load: function(fen) { return load(fen); },
    reset: function() { return reset(); },
    moves: function(options) {
      var ugly_moves = generate_moves(options), moves = [];
      for (var i=0,len=ugly_moves.length;i<len;i++) {
        if (typeof options!=='undefined' && 'verbose' in options && options.verbose) moves.push(make_pretty(ugly_moves[i]));
        else moves.push(move_to_san(ugly_moves[i], false));
      }
      return moves;
    },
    in_check: function() { return in_check(); },
    in_checkmate: function() { return in_checkmate(); },
    in_stalemate: function() { return in_stalemate(); },
    in_draw: function() { return half_moves>=100||in_stalemate()||insufficient_material()||in_threefold_repetition(); },
    insufficient_material: function() { return insufficient_material(); },
    in_threefold_repetition: function() { return in_threefold_repetition(); },
    game_over: function() { return half_moves>=100||in_checkmate()||in_stalemate()||insufficient_material()||in_threefold_repetition(); },
    fen: function() { return generate_fen(); },
    board: function() {
      var output=[], row=[];
      for (var i=SQUARES.a8;i<=SQUARES.h1;i++) {
        if (board[i]==null) row.push(null); else row.push({type:board[i].type,color:board[i].color});
        if ((i+1)&0x88) { output.push(row); row=[]; i+=8; }
      }
      return output;
    },
    turn: function() { return turn; },
    move: function(move, options) {
      var sloppy = typeof options!=='undefined' && 'sloppy' in options ? options.sloppy : false;
      var move_obj = null;
      if (typeof move === 'string') { move_obj = move_from_san(move, sloppy); }
      else if (typeof move === 'object') {
        var moves = generate_moves();
        for (var i=0,len=moves.length;i<len;i++) {
          if (move.from===algebraic(moves[i].from) && move.to===algebraic(moves[i].to) &&
              (!('promotion' in moves[i]) || move.promotion===moves[i].promotion))
            { move_obj=moves[i]; break; }
        }
      }
      if (!move_obj) return null;
      var pretty_move = make_pretty(move_obj); make_move(move_obj); return pretty_move;
    },
    undo: function() { var move=undo_move(); return move ? make_pretty(move) : null; },
    fast_moves: function() { return generate_moves(); },
    fast_captures: function() { return generate_captures(); },
    fast_make: function(m) { make_move(m); },
    fast_undo: function() { undo_move(); },
    fast_raw_u: function(xt) {
      var Uw=0, Ub=0;
      for (var i=SQUARES.a8; i<=SQUARES.h1; i++) {
        if (i&0x88) { i+=7; continue; }
        var p=board[i]; if (p==null) continue;
        var r=7-(i>>4), f=i&7, idx=r*8+f;
        if (p.color===WHITE) Uw+=xt['w'+p.type][idx];
        else Ub+=xt['b'+p.type][idx];
      }
      return (turn===WHITE) ? Uw-Ub : Ub-Uw;
    },
    fast_raw_u_split: function(xt) {
      var Uw=0, Ub=0;
      for (var i=SQUARES.a8; i<=SQUARES.h1; i++) {
        if (i&0x88) { i+=7; continue; }
        var p=board[i]; if (p==null) continue;
        var r=7-(i>>4), f=i&7, idx=r*8+f;
        if (p.color===WHITE) Uw+=xt['w'+p.type][idx]; else Ub+=xt['b'+p.type][idx];
      }
      return { Uw:Uw, Ub:Ub };
    },
    fast_in_check: function() { return in_check(); },
    fast_in_checkmate: function() { return in_checkmate(); },
    fast_turn: function() { return turn; },
    fast_to_san: function(m) { return move_to_san(m); },
    fast_algebraic: function(i) { return algebraic(i); },
    fast_hash: function() {
      var h = (turn === WHITE) ? 0x811c9dc5 : 0x050c5d1f;
      for (var i=SQUARES.a8; i<=SQUARES.h1; i++) {
        if (i&0x88) { i+=7; continue; }
        var p=board[i];
        var v = p ? (p.color===WHITE ? 0 : 6) + SHIFTS[p.type] + 1 : 0;
        h = Math.imul(h ^ v, 0x01000193);
      }
      h = Math.imul(h ^ ((castling.w << 4) | castling.b), 0x01000193);
      h = Math.imul(h ^ (ep_square + 2), 0x01000193);
      return h | 0;
    }
  };
};

// ================================================================
// THERMODYNAMIC ENGINE (from chess_thermo_4.html)
// ================================================================
const T_FLOOR = 0.1;
const PIECE_VALUE = { p:8, n:24, b:26, r:40, q:72, k:0 };
const PAWN_XRAY = 11;
const CHECKMATE_SCORE = 100000;
const BOLTZ_SIGMA = 3;
const NODE_HARD_LIMIT = 1000000;

const XRAY = {};
(function buildXrayTable() {
    function xm(type, file, rank, color) {
        switch (type) {
            case 'r': return 14;
            case 'b': return Math.min(file,rank)+Math.min(7-file,rank)+Math.min(file,7-rank)+Math.min(7-file,7-rank);
            case 'q': return 14+Math.min(file,rank)+Math.min(7-file,rank)+Math.min(file,7-rank)+Math.min(7-file,7-rank);
            case 'n': { let c=0; for (const [df,dr] of [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]]) if (file+df>=0&&file+df<=7&&rank+dr>=0&&rank+dr<=7) c++; return c; }
            case 'k': { let c=0; for (let df=-1;df<=1;df++) for (let dr=-1;dr<=1;dr++) { if (!df&&!dr) continue; if (file+df>=0&&file+df<=7&&rank+dr>=0&&rank+dr<=7) c++; } return c; }
            case 'p': { let c=0,dir=color==='w'?1:-1,nr=rank+dir; if (nr>=0&&nr<=7) { c++; if (file>0) c++; if (file<7) c++; } if (rank===(color==='w'?1:6)) { if (rank+2*dir>=0&&rank+2*dir<=7) c++; } return c; }
        }
        return 0;
    }
    for (const color of ['w','b'])
        for (const type of ['p','n','b','r','q','k']) {
            const t = new Int8Array(64);
            const base = PIECE_VALUE[type];
            for (let rank=0;rank<8;rank++) for (let file=0;file<8;file++) t[rank*8+file]=base+xm(type,file,rank,color);
            XRAY[color+type] = t;
        }
})();

let thermoNodeCount = 0;
let thermoCache = new Map();
let thermoDeadline = Infinity;
let activeC = 1.0;

function quiesce(g, alpha, beta) {
    thermoNodeCount++;
    const inCheck = g.fast_in_check();
    if (!inCheck) {
        const standPat = g.fast_raw_u(XRAY);
        if (standPat >= beta) return standPat;
        if (standPat > alpha) alpha = standPat;
    }
    const moves = inCheck ? g.fast_moves() : g.fast_captures();
    if (moves.length === 0) return inCheck ? -CHECKMATE_SCORE : alpha;
    for (let i = 0; i < moves.length; i++) {
        g.fast_make(moves[i]);
        const score = -quiesce(g, -beta, -alpha);
        g.fast_undo();
        if (score >= beta) return score;
        if (score > alpha) alpha = score;
    }
    return alpha;
}

function robustT(Qs, n) {
    const sqrtC = Math.sqrt(activeC);
    const tmp = new Array(n);
    for (let i=0;i<n;i++) tmp[i]=Qs[i];
    tmp.sort((a,b) => a-b);
    const med = n&1 ? tmp[n>>1] : (tmp[(n>>1)-1]+tmp[n>>1])*0.5;
    for (let i=0;i<n;i++) tmp[i]=Math.abs(Qs[i]-med);
    tmp.sort((a,b) => a-b);
    const mad = n&1 ? tmp[n>>1] : (tmp[(n>>1)-1]+tmp[n>>1])*0.5;
    let T = Math.max(1.4826*mad / sqrtC, T_FLOOR);
    let maxQ=Qs[0];
    for (let i=1;i<n;i++) if (Qs[i]>maxQ) maxQ=Qs[i];
    for (let iter=0; iter<8; iter++) {
        let expSum=0;
        for (let i=0;i<n;i++) { tmp[i]=Math.exp((Qs[i]-maxQ)/T); expSum+=tmp[i]; }
        let avgQ=0, avgQ2=0;
        for (let i=0;i<n;i++) { const p=tmp[i]/expSum; avgQ+=p*Qs[i]; avgQ2+=p*Qs[i]*Qs[i]; }
        const sigW = Math.sqrt(Math.max(avgQ2 - avgQ*avgQ, 0));
        const Tnew = Math.max(sigW / sqrtC, T_FLOOR);
        if (Math.abs(Tnew-T) < 0.01) break;
        T = Math.max(Math.sqrt(T*Tnew), T_FLOOR);
    }
    return T;
}

function thermoSearch(g, depth, pathKeys) {
    thermoNodeCount++;
    if (thermoNodeCount > NODE_HARD_LIMIT && depth > 1) depth = 1;
    if ((thermoNodeCount & 0xFFF) === 0 && performance.now() > thermoDeadline) return 0;
    if (depth <= 0) return quiesce(g, -Infinity, Infinity);
    const posKey = g.fast_hash();
    if (pathKeys.has(posKey)) return 0;
    const key = depth + ':' + posKey;
    const cached = thermoCache.get(key);
    if (cached !== undefined) return cached;
    const moves = g.fast_moves();
    const n = moves.length;
    if (n === 0) {
        const v = g.fast_in_check() ? -CHECKMATE_SCORE : 0;
        if (thermoCache.size < 100000) thermoCache.set(key, v);
        return v;
    }
    let Qs;
    if (depth <= 2) {
        Qs = new Array(n);
        pathKeys.add(posKey);
        for (let i = 0; i < n; i++) {
            g.fast_make(moves[i]);
            Qs[i] = -thermoSearch(g, depth - 1, pathKeys);
            g.fast_undo();
        }
        pathKeys.delete(posKey);
    } else {
        const quickQs = new Array(n);
        pathKeys.add(posKey);
        for (let i = 0; i < n; i++) {
            g.fast_make(moves[i]);
            quickQs[i] = -thermoSearch(g, depth - 2, pathKeys);
            g.fast_undo();
        }
        let qMax = quickQs[0];
        for (let i = 1; i < n; i++) if (quickQs[i] > qMax) qMax = quickQs[i];
        const T_est = robustT(quickQs, n);
        const threshold = qMax - BOLTZ_SIGMA * T_est;
        const exactIdx = [];
        const samplePool = [];
        for (let i = 0; i < n; i++) {
            if (quickQs[i] >= threshold) exactIdx.push(i);
            else samplePool.push(i);
        }
        Qs = quickQs.slice();
        for (let i = 0; i < exactIdx.length; i++) {
            const idx = exactIdx[i];
            g.fast_make(moves[idx]);
            Qs[idx] = -thermoSearch(g, depth - 1, pathKeys);
            g.fast_undo();
        }
        const mcSamples = Math.min(Math.ceil(samplePool.length * 0.2), 8);
        if (mcSamples > 0 && samplePool.length > 0) {
            let sMaxQ = quickQs[samplePool[0]];
            for (let j = 1; j < samplePool.length; j++)
                if (quickQs[samplePool[j]] > sMaxQ) sMaxQ = quickQs[samplePool[j]];
            const weights = new Array(samplePool.length);
            let wSum = 0;
            for (let j = 0; j < samplePool.length; j++) {
                weights[j] = Math.exp((quickQs[samplePool[j]] - sMaxQ) / T_est);
                wSum += weights[j];
            }
            const picked = new Uint8Array(samplePool.length);
            for (let k = 0; k < mcSamples && wSum > 1e-30; k++) {
                let r = Math.random() * wSum;
                let chosen = -1;
                for (let j = 0; j < samplePool.length; j++) {
                    if (picked[j]) continue;
                    r -= weights[j];
                    if (r <= 0) { chosen = j; break; }
                }
                if (chosen < 0) {
                    for (let j = samplePool.length - 1; j >= 0; j--)
                        if (!picked[j]) { chosen = j; break; }
                }
                if (chosen < 0) break;
                picked[chosen] = 1;
                wSum -= weights[chosen];
                const idx = samplePool[chosen];
                g.fast_make(moves[idx]);
                Qs[idx] = -thermoSearch(g, depth - 1, pathKeys);
                g.fast_undo();
            }
        }
        pathKeys.delete(posKey);
    }
    return computeF(Qs, n, key);
}

function computeF(Qs, n, cacheKey) {
    const T = robustT(Qs, n);
    let maxQ = Qs[0];
    for (let i = 1; i < n; i++) if (Qs[i] > maxQ) maxQ = Qs[i];
    if (!Number.isFinite(maxQ)) {
        if (cacheKey && thermoCache.size < 100000) thermoCache.set(cacheKey, maxQ);
        return maxQ;
    }
    let expSum = 0;
    for (let i = 0; i < n; i++) expSum += Math.exp((Qs[i] - maxQ) / T);
    const val = maxQ + T * Math.log(expSum);
    if (cacheKey && thermoCache.size < 100000) thermoCache.set(cacheKey, val);
    return val;
}

function thermoBestMove(g, timeLimitMs, gamePositions) {
    thermoDeadline = performance.now() + timeLimitMs;
    thermoNodeCount = 0;
    thermoCache = new Map();
    activeC = 1.0;

    const moves = g.fast_moves();
    const n = moves.length;
    if (n === 0) return null;
    if (n === 1) return g.fast_to_san(moves[0]);

    let bestIdx = 0;
    let reachedDepth = 0;
    const pathKeys = new Set();
    const rootPosKey = g.fast_hash();

    for (let depth = 1; depth <= 64; depth++) {
        const Qs = new Array(n);
        let timedOut = false;
        pathKeys.clear();
        pathKeys.add(rootPosKey);
        if (gamePositions) {
            for (const k of gamePositions.keys()) pathKeys.add(k);
        }
        for (let i = 0; i < n; i++) {
            g.fast_make(moves[i]);
            const childHash = g.fast_hash();
            const gameCount = gamePositions ? (gamePositions.get(childHash) || 0) : 0;
            if (gameCount >= 2) {
                Qs[i] = 0;
            } else {
                Qs[i] = -thermoSearch(g, depth - 1, pathKeys);
                if (gameCount >= 1) Qs[i] -= 15;
            }
            g.fast_undo();
            if (performance.now() > thermoDeadline) { timedOut = true; break; }
        }
        if (timedOut && reachedDepth > 0) break;
        bestIdx = 0;
        for (let i = 1; i < n; i++) if (Qs[i] > Qs[bestIdx]) bestIdx = i;
        reachedDepth = depth;
        if (depth < 64) {
            const order = [];
            for (let i = 0; i < n; i++) order.push(i);
            order.sort((a, b) => Qs[b] - Qs[a]);
            const newMoves = new Array(n);
            for (let i = 0; i < n; i++) newMoves[i] = moves[order[i]];
            for (let i = 0; i < n; i++) moves[i] = newMoves[i];
            bestIdx = 0;
        }
        if (performance.now() > thermoDeadline) break;
        if (thermoNodeCount > NODE_HARD_LIMIT) break;
    }
    return g.fast_to_san(moves[bestIdx]);
}

// ================================================================
// TRADITIONAL MINIMAX ENGINE (alpha-beta + PST)
// ================================================================

const MM_PIECE_VAL = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000 };

// Piece-square tables (from white's perspective, index = rank*8+file, rank 0 = rank 1)
const PST = {
  p: [
     0,  0,  0,  0,  0,  0,  0,  0,
    50, 50, 50, 50, 50, 50, 50, 50,
    10, 10, 20, 30, 30, 20, 10, 10,
     5,  5, 10, 25, 25, 10,  5,  5,
     0,  0,  0, 20, 20,  0,  0,  0,
     5, -5,-10,  0,  0,-10, -5,  5,
     5, 10, 10,-20,-20, 10, 10,  5,
     0,  0,  0,  0,  0,  0,  0,  0
  ],
  n: [
    -50,-40,-30,-30,-30,-30,-40,-50,
    -40,-20,  0,  0,  0,  0,-20,-40,
    -30,  0, 10, 15, 15, 10,  0,-30,
    -30,  5, 15, 20, 20, 15,  5,-30,
    -30,  0, 15, 20, 20, 15,  0,-30,
    -30,  5, 10, 15, 15, 10,  5,-30,
    -40,-20,  0,  5,  5,  0,-20,-40,
    -50,-40,-30,-30,-30,-30,-40,-50
  ],
  b: [
    -20,-10,-10,-10,-10,-10,-10,-20,
    -10,  0,  0,  0,  0,  0,  0,-10,
    -10,  0, 10, 10, 10, 10,  0,-10,
    -10,  5,  5, 10, 10,  5,  5,-10,
    -10,  0, 10, 10, 10, 10,  0,-10,
    -10, 10, 10, 10, 10, 10, 10,-10,
    -10,  5,  0,  0,  0,  0,  5,-10,
    -20,-10,-10,-10,-10,-10,-10,-20
  ],
  r: [
     0,  0,  0,  0,  0,  0,  0,  0,
     5, 10, 10, 10, 10, 10, 10,  5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
     0,  0,  0,  5,  5,  0,  0,  0
  ],
  q: [
    -20,-10,-10, -5, -5,-10,-10,-20,
    -10,  0,  0,  0,  0,  0,  0,-10,
    -10,  0,  5,  5,  5,  5,  0,-10,
     -5,  0,  5,  5,  5,  5,  0, -5,
      0,  0,  5,  5,  5,  5,  0, -5,
    -10,  5,  5,  5,  5,  5,  0,-10,
    -10,  0,  5,  0,  0,  0,  0,-10,
    -20,-10,-10, -5, -5,-10,-10,-20
  ],
  k: [
    -30,-40,-40,-50,-50,-40,-40,-30,
    -30,-40,-40,-50,-50,-40,-40,-30,
    -30,-40,-40,-50,-50,-40,-40,-30,
    -30,-40,-40,-50,-50,-40,-40,-30,
    -20,-30,-30,-40,-40,-30,-30,-20,
    -10,-20,-20,-20,-20,-20,-20,-10,
     20, 20,  0,  0,  0,  0, 20, 20,
     20, 30, 10,  0,  0, 10, 30, 20
  ]
};

// Mirror table for black
const PST_BLACK = {};
for (const piece of ['p','n','b','r','q','k']) {
    PST_BLACK[piece] = new Array(64);
    for (let i = 0; i < 64; i++) {
        const mirrorRank = 7 - Math.floor(i / 8);
        const file = i % 8;
        PST_BLACK[piece][i] = PST[piece][mirrorRank * 8 + file];
    }
}

let mmNodeCount = 0;
let mmDeadline = Infinity;

function mmEvaluate(g) {
    const b = g.board();
    let score = 0;
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const p = b[row][col];
            if (!p) continue;
            const rank = 7 - row;
            const idx = rank * 8 + col;
            if (p.color === 'w') {
                score += MM_PIECE_VAL[p.type] + PST[p.type][idx];
            } else {
                score -= MM_PIECE_VAL[p.type] + PST_BLACK[p.type][idx];
            }
        }
    }
    return g.turn() === 'w' ? score : -score;
}

function mmQuiesce(g, alpha, beta) {
    mmNodeCount++;
    const standPat = mmEvaluate(g);
    if (standPat >= beta) return beta;
    if (standPat > alpha) alpha = standPat;

    const moves = g.fast_captures();
    for (let i = 0; i < moves.length; i++) {
        g.fast_make(moves[i]);
        const score = -mmQuiesce(g, -beta, -alpha);
        g.fast_undo();
        if (score >= beta) return beta;
        if (score > alpha) alpha = score;
    }
    return alpha;
}

function mmAlphaBeta(g, depth, alpha, beta) {
    mmNodeCount++;
    if ((mmNodeCount & 0xFFF) === 0 && performance.now() > mmDeadline) return 0;

    if (depth <= 0) return mmQuiesce(g, alpha, beta);

    const moves = g.fast_moves();
    if (moves.length === 0) {
        return g.fast_in_check() ? -100000 + (100 - depth) : 0;
    }

    // MVV-LVA move ordering
    const CAPTURE_VAL = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
    moves.sort((a, b) => {
        const aCapVal = a.captured ? CAPTURE_VAL[a.captured] * 10 - CAPTURE_VAL[a.piece] : 0;
        const bCapVal = b.captured ? CAPTURE_VAL[b.captured] * 10 - CAPTURE_VAL[b.piece] : 0;
        return bCapVal - aCapVal;
    });

    for (let i = 0; i < moves.length; i++) {
        g.fast_make(moves[i]);
        const score = -mmAlphaBeta(g, depth - 1, -beta, -alpha);
        g.fast_undo();
        if (score >= beta) return beta;
        if (score > alpha) alpha = score;
    }
    return alpha;
}

function mmBestMove(g, timeLimitMs, gamePositions) {
    mmDeadline = performance.now() + timeLimitMs;
    mmNodeCount = 0;
    const moves = g.fast_moves();
    if (moves.length === 0) return null;
    if (moves.length === 1) return g.fast_to_san(moves[0]);

    let bestIdx = 0;
    let reachedDepth = 0;

    for (let depth = 1; depth <= 64; depth++) {
        let bestScore = -Infinity;
        let currentBest = 0;
        let timedOut = false;

        for (let i = 0; i < moves.length; i++) {
            g.fast_make(moves[i]);
            const childHash = g.fast_hash();
            const gameCount = gamePositions ? (gamePositions.get(childHash) || 0) : 0;
            let score;
            if (gameCount >= 2) {
                score = 0;
            } else {
                score = -mmAlphaBeta(g, depth - 1, -Infinity, -bestScore);
                if (gameCount >= 1) score -= 50;
            }
            g.fast_undo();

            if (score > bestScore) {
                bestScore = score;
                currentBest = i;
            }
            if (performance.now() > mmDeadline) { timedOut = true; break; }
        }

        if (timedOut && reachedDepth > 0) break;
        bestIdx = currentBest;
        reachedDepth = depth;

        if (depth < 64) {
            const best = moves[bestIdx];
            for (let i = bestIdx; i > 0; i--) moves[i] = moves[i-1];
            moves[0] = best;
            bestIdx = 0;
        }

        if (performance.now() > mmDeadline) break;
    }
    return g.fast_to_san(moves[bestIdx]);
}

// ================================================================
// TOURNAMENT RUNNER
// ================================================================

const MAX_GAME_MOVES = 150;
const TIME_PER_MOVE_MS = 300;

// 15 standard opening positions (FEN after ~4-6 moves) for game diversity
const OPENING_FENS = [
    // 1. Italian Game
    "r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3",
    // 2. Sicilian Najdorf
    "rnbqkb1r/1p2pppp/p2p1n2/8/3NP3/2N5/PPP2PPP/R1BQKB1R w KQkq - 0 6",
    // 3. French Defense
    "rnbqkbnr/pppp1ppp/4p3/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2",
    // 4. Caro-Kann
    "rnbqkbnr/pp1ppppp/2p5/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2",
    // 5. Queen's Gambit Declined
    "rnbqkb1r/ppp1pppp/5n2/3p4/2PP4/8/PP2PPPP/RNBQKBNR w KQkq - 2 3",
    // 6. King's Indian
    "rnbqkb1r/pppppp1p/5np1/8/2PP4/8/PP2PPPP/RNBQKBNR w KQkq - 0 3",
    // 7. Slav Defense
    "rnbqkbnr/pp2pppp/2p5/3p4/2PP4/8/PP2PPPP/RNBQKBNR w KQkq - 0 3",
    // 8. Ruy Lopez
    "r1bqkbnr/pppp1ppp/2n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3",
    // 9. English Opening
    "rnbqkbnr/pppp1ppp/8/4p3/2P5/8/PP1PPPPP/RNBQKBNR w KQkq - 0 2",
    // 10. Scotch Game
    "r1bqkbnr/pppp1ppp/2n5/4p3/3PP3/5N2/PPP2PPP/RNBQKB1R b KQkq - 0 3",
    // 11. Pirc Defense
    "rnbqkb1r/ppp1pp1p/3p1np1/8/3PP3/2N5/PPP2PPP/R1BQKBNR w KQkq - 0 4",
    // 12. Nimzo-Indian
    "rnbqk2r/pppp1ppp/4pn2/8/1bPP4/2N5/PP2PPPP/R1BQKBNR w KQkq - 2 4",
    // 13. Grunfeld
    "rnbqkb1r/ppp1pp1p/5np1/3p4/2PP4/2N5/PP2PPPP/R1BQKBNR w KQkq - 0 4",
    // 14. Philidor Defense
    "rnbqkbnr/ppp2ppp/3p4/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 0 3",
    // 15. Scandinavian
    "rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2",
];

function playGame(thermoIsWhite, openingFen) {
    const g = openingFen ? new Chess(openingFen) : new Chess();
    let moveCount = 0;
    const moveSans = [];
    const positionCounts = new Map();
    const startHash = g.fast_hash();
    positionCounts.set(startHash, 1);

    while (!g.game_over() && moveCount < MAX_GAME_MOVES) {
        const isWhiteTurn = g.turn() === 'w';
        const isThermoTurn = (isWhiteTurn === thermoIsWhite);
        let san;

        if (isThermoTurn) {
            san = thermoBestMove(g, TIME_PER_MOVE_MS, positionCounts);
        } else {
            san = mmBestMove(g, TIME_PER_MOVE_MS, positionCounts);
        }

        if (!san) break;
        const result = g.move(san);
        if (!result) break;
        moveSans.push(result.san);
        moveCount++;

        const posHash = g.fast_hash();
        positionCounts.set(posHash, (positionCounts.get(posHash) || 0) + 1);
    }

    let result;
    if (g.in_checkmate()) {
        result = g.turn() === 'w' ? '0-1' : '1-0';
    } else {
        result = '1/2-1/2';
    }

    // Score from thermo's perspective
    let thermoScore;
    if (result === '1/2-1/2') {
        thermoScore = 0.5;
    } else if ((result === '1-0' && thermoIsWhite) || (result === '0-1' && !thermoIsWhite)) {
        thermoScore = 1.0;
    } else {
        thermoScore = 0.0;
    }

    return { result, thermoScore, moves: moveSans.length, moveSans, thermoIsWhite };
}

function estimateElo(score, n) {
    if (score <= 0) return -400;
    if (score >= n) return 400;
    const winRate = score / n;
    const elo = -400 * Math.log10(1 / winRate - 1);
    return elo;
}

function eloConfidenceInterval(score, n) {
    const p = score / n;
    const se = Math.sqrt(p * (1 - p) / n);
    const pLow = Math.max(0.001, p - 1.96 * se);
    const pHigh = Math.min(0.999, p + 1.96 * se);
    const eloLow = -400 * Math.log10(1 / pLow - 1);
    const eloHigh = -400 * Math.log10(1 / pHigh - 1);
    return { eloLow, eloHigh };
}

// Main
const NUM_GAMES = 30;
console.log("=".repeat(65));
console.log("  CHESS TOURNAMENT: Thermodynamic Engine vs Traditional Minimax");
console.log("=".repeat(65));
console.log(`  Games: ${NUM_GAMES} | Time/move: ${TIME_PER_MOVE_MS}ms | Max moves/game: ${MAX_GAME_MOVES}`);
console.log(`  Thermo engine: C=1.0, Boltzmann search with quiescence`);
console.log(`  Minimax engine: Alpha-beta + PST + quiescence + MVV-LVA`);
console.log("=".repeat(65));
console.log("");

let thermoWins = 0, mmWins = 0, draws = 0;
let thermoTotalScore = 0;
const gameResults = [];
const startTime = performance.now();

for (let i = 0; i < NUM_GAMES; i++) {
    const thermoIsWhite = (i % 2 === 0);
    const openingIdx = Math.floor(i / 2) % OPENING_FENS.length;
    const openingFen = OPENING_FENS[openingIdx];
    const gameStart = performance.now();
    const result = playGame(thermoIsWhite, openingFen);
    const elapsed = ((performance.now() - gameStart) / 1000).toFixed(1);

    gameResults.push(result);
    thermoTotalScore += result.thermoScore;

    if (result.thermoScore === 1) thermoWins++;
    else if (result.thermoScore === 0) mmWins++;
    else draws++;

    const thermoSide = thermoIsWhite ? "W" : "B";
    const scoreStr = result.thermoScore === 1 ? "1-0" : result.thermoScore === 0 ? "0-1" : "1/2";
    const runningPct = ((thermoTotalScore / (i + 1)) * 100).toFixed(1);

    // Build PGN-style move string
    let moveStr = '';
    for (let m = 0; m < result.moveSans.length; m += 2) {
        moveStr += (m/2+1) + '.' + result.moveSans[m];
        if (result.moveSans[m+1]) moveStr += ' ' + result.moveSans[m+1];
        moveStr += ' ';
    }

    const openingName = [
        "Italian","Najdorf","French","Caro-Kann","QGD","KID","Slav",
        "Ruy Lopez","English","Scotch","Pirc","Nimzo-Indian","Grunfeld",
        "Philidor","Scandinavian"
    ][openingIdx];

    console.log(
        `Game ${String(i + 1).padStart(2)}: Thermo(${thermoSide}) ${scoreStr.padEnd(4)} ` +
        `in ${String(result.moves).padStart(3)} moves (${elapsed}s) [${openingName}] | ` +
        `Running: ${thermoTotalScore}/${i + 1} (${runningPct}%)`
    );
}

const totalElapsed = ((performance.now() - startTime) / 1000).toFixed(1);
const eloDiff = estimateElo(thermoTotalScore, NUM_GAMES);
const { eloLow, eloHigh } = eloConfidenceInterval(thermoTotalScore, NUM_GAMES);

console.log("");
console.log("=".repeat(65));
console.log("  TOURNAMENT RESULTS");
console.log("=".repeat(65));
console.log(`  Thermo wins:  ${thermoWins}`);
console.log(`  Minimax wins: ${mmWins}`);
console.log(`  Draws:        ${draws}`);
console.log(`  Thermo score: ${thermoTotalScore} / ${NUM_GAMES} (${((thermoTotalScore/NUM_GAMES)*100).toFixed(1)}%)`);
console.log("");
console.log(`  Elo difference: ${eloDiff >= 0 ? '+' : ''}${Math.round(eloDiff)} (Thermo vs Minimax)`);
console.log(`  95% CI:         [${Math.round(eloLow)}, ${Math.round(eloHigh)}]`);
console.log("");
console.log(`  Total time:     ${totalElapsed}s`);

if (eloDiff > 0) {
    console.log(`  => Thermo engine is ~${Math.round(eloDiff)} Elo STRONGER than the minimax baseline`);
} else if (eloDiff < 0) {
    console.log(`  => Thermo engine is ~${Math.round(Math.abs(eloDiff))} Elo WEAKER than the minimax baseline`);
} else {
    console.log(`  => Engines are approximately equal strength`);
}

console.log("");
console.log("  Note: Minimax baseline with PST is roughly ~1200-1400 Elo.");
console.log("  Add the Elo difference to estimate Thermo's absolute rating.");
console.log("=".repeat(65));
