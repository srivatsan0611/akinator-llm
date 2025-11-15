import mongoose from 'mongoose';

const GameSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  chatHistory: [
    {
      role: String,
      content: String,
    },
  ],
  finalGuess: String,
  status: {
    type: String,
    enum: ['won', 'abandoned'],
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const Game = mongoose.models.Game || mongoose.model('Game', GameSchema);

export default Game;
