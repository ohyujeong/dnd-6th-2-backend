import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Article, ArticleDocument } from '../schemas/article.schema';
import { KeyWord, KeyWordDocument } from '../schemas/keyword.schema';
import { User, UserDocument } from 'src/auth/schemas/user.schema';
import { CreateArticleDto } from '../dto/create-article.dto';
import { CreateKeyWordDto } from '../dto/create-keyword.dto';

export class ChallengeRepository {
  constructor(
    @InjectModel(Article.name)
    private ArticleModel: Model<ArticleDocument>,
    @InjectModel(KeyWord.name)
    private KeyWordModel: Model<KeyWordDocument>,
    @InjectModel(User.name)
    private UserModel: Model<UserDocument>,
  ) {}
  private todayKeyWord: KeyWord[] = [];

  async saveKeyWord(createKeyWordDto: CreateKeyWordDto): Promise<KeyWord> {
    const KeyWord = new this.KeyWordModel(createKeyWordDto);
    return KeyWord.save();
  }

  async findKeyWord(): Promise<KeyWord[]> {
    return this.KeyWordModel.find();
  }

  async updateKeyWord(): Promise<KeyWord[]> {
    const today = new Date().toDateString();

    //안 쓴 키워드 중에서 매일 키워드 하나를 랜덤 추출해주고 추출한 키워드 정보를 업데이트 해줌
    const keyWord = await this.KeyWordModel.aggregate([
      { $match: { state: false } },
      { $sample: { size: 1 } },
    ]);
    this.todayKeyWord[0] = await this.KeyWordModel.findOneAndUpdate(
      { content: keyWord[0].content },
      {
        $set: {
          state: true,
          updateDay: today,
        },
      },
    );
    return this.todayKeyWord;
  }

  //개발용 함수 (서버 계속 껐다 키니까 presenetKeyWord 변수 만들어서 임시적으로 오늘의 키워드 저장해주고 보여줌)
  async findRandomKeyWord(user): Promise<any[]> {
    const result: any[] = [];
    const today = new Date().toDateString();
    const presentKeyWord: KeyWord[] = [];
    presentKeyWord.push(await this.KeyWordModel.findOne({ updateDay: today }));
    this.todayKeyWord = presentKeyWord;
    result.push(presentKeyWord[0]);
    const challenge = await this.ArticleModel.find({
      user: user,
      state: true,
      keyWord: presentKeyWord[0].content,
    });
    result.push(challenge);
    const userinfo = await this.UserModel.findById(user._id);
    result.push(userinfo);
    return result;
    // } else {
    //   const todayKeyWord = await this.KeyWordModel.findOne({
    //     content: this.todayKeyWord[0].content,
    //   });
    //   result.push(todayKeyWord);
    //   const challenge = await this.ArticleModel.findOne({
    //     state: true,
    //     keyWord: todayKeyWord[0].content,
    //   });
    //   result.push(challenge);
    //   return result;
    // }
  }

  // 배포용 ( 키워드, 챌린지 여부 리턴)
  // async findRandomKeyWord(user): Promise<any[]> {
  //     let result:any[] = [];
  //     const challenge = await this.ArticleModel.find({
  //      user: user,
  //      state: true,
  //      keyWord:this.todayKeyWord[0].content
  //       });
  //     result.push(challenge)
  //     const todayKeyWord = await this.KeyWordModel.findOne({
  //       content: this.todayKeyWord[0].content,
  //     });
  //     result.push(todayKeyWord)
  //     const userinfo = await this.UserModel.findById(user._id)
  //     result.push(userinfo);
  //     return result;
  // }

  async saveArticle(
    user,
    createArticleDto: CreateArticleDto,
  ): Promise<Article> {
    createArticleDto.user = user._id;
    createArticleDto.keyWord = this.todayKeyWord[0].content;
    createArticleDto.state = true;
    const article = await new this.ArticleModel(createArticleDto);
    const loginUser = await this.UserModel.findByIdAndUpdate(user._id, {
      $push: {
        articles: article,
      },
      $inc: {
        challenge: 1,
      },
    });
    if(loginUser.state == false){ //오늘 챌린지 안 했을 때만(최초 챌린지 일 때)
      await this.UserModel.findByIdAndUpdate(user._id,{
        $inc: {
          stampCount: 1
        },
        $set: {
          state: true
        }
      })
    }
    return article.save();
  }

  //임시저장
  async temporarySaveArticle(
    user,
    createArticleDto: CreateArticleDto,
  ): Promise<Article> {
    createArticleDto.user = user._id;
    createArticleDto.keyWord = this.todayKeyWord[0].content;
    createArticleDto.state = false;
    const article = await new this.ArticleModel(createArticleDto);
    await this.UserModel.findByIdAndUpdate(user._id, {
      $push: {
        temporary: article,
      },
    });
    return article.save();
  }

  //매일 유저들의 챌린지 여부 리셋
  async resetChallenge(): Promise<any> {
    return await this.UserModel.updateMany({
      $set:{
        state: false
      }
    })
  }

  // async findAllArticle(): Promise<Article[]> {
  //   return this.ArticleModel.find().exec();
  // }

  // async findOneArticle(id): Promise<Article> {
  //   return await this.ArticleModel.findById(id);
  // }

  // async deleteArticle(id): Promise<any> {
  //   return await this.ArticleModel.findByIdAndRemove(id);
  // }
}
