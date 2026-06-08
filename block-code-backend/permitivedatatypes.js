export class Expr
//Fake abstract class represent a python expression
{
     evaluate()
    {

    }
}

export class num extends Expr{
    constructor(number){
        this.value = number;
    }
    evaluate(){
        return this.value;
    }
    toString(){
        return `${this.value}`;
    }
} 

export class Booleans extends Expr{
    constructor(value){
        this.value = value;
    }
    evaluate(){
        return this.value;
    }
    toString(){
        return `${this.value}`;
    }

}
export class Strings extends ExprP{
    constructor(text){
        this.value = text;
    }
    evaluate(){
        return this.toString();
    }
    toString(){
        return this.value;
    }
}

